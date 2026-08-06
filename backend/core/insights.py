"""
Insight engine: the "analyst + teacher" layer.

Two stages:
  1. scan_content(rel_path, content): regex-based static analysis executed while
     files are already in memory during parsing (security + quality markers).
  2. build_insights(...): graph-level detectors (cycles, god files, orphans,
     tangled modules) merged with the per-file findings, each enriched with
     didactic content in Spanish (what / why it matters / how to fix).

Severity scale: critical > high > medium > low > info.
"""

import re
from collections import defaultdict
from typing import Dict, List

import networkx as nx

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}

# ---------------------------------------------------------------------------
# Stage 1: content scanners
# ---------------------------------------------------------------------------

_CONTENT_RULES = [
    {
        "key": "hardcoded_secret",
        "pattern": re.compile(
            r"""(?ix)(?:api[_-]?key|apikey|secret|passwd|password|auth[_-]?token|access[_-]?key)
                \s*[:=]\s*["'][A-Za-z0-9_\-+/=.]{8,}["']"""),
        "exclude": re.compile(r"(?i)(example|placeholder|changeme|your[_-]?|xxx|<|\{\{|process\.env|os\.environ|getenv)"),
        "severity": "critical",
        "category": "security",
        "title": "Posible secreto hardcodeado",
        "explanation": "Se encontró lo que parece una clave, contraseña o token escrito directamente en el código.",
        "why": "Cualquiera con acceso al repositorio (o a su historial de git) puede robar esa credencial y usarla contra tus servicios. Es una de las causas más comunes de brechas de seguridad reales.",
        "fix": "Mueve el valor a una variable de entorno (.env fuera de git) o a un gestor de secretos, y rota la credencial expuesta: bórrala del proveedor y genera una nueva.",
    },
    {
        "key": "eval_usage",
        "pattern": re.compile(r"(?<![\w.])(?:eval|exec)\s*\("),
        "severity": "high",
        "category": "security",
        "title": "Uso de eval/exec",
        "explanation": "El archivo ejecuta código construido en tiempo de ejecución con eval() o exec().",
        "why": "Si cualquier parte de esa cadena proviene del usuario, se convierte en ejecución remota de código (RCE): el atacante literalmente escribe tu programa.",
        "fix": "Reemplaza eval por estructuras de datos (dict de funciones, json.loads, ast.literal_eval) o un parser específico. Casi siempre hay una alternativa segura.",
    },
    {
        "key": "shell_true",
        "pattern": re.compile(r"subprocess\.[A-Za-z_]+\([^)]*shell\s*=\s*True"),
        "severity": "high",
        "category": "security",
        "title": "subprocess con shell=True",
        "explanation": "Se lanza un comando de sistema a través del shell.",
        "why": "Con shell=True, cualquier variable interpolada en el comando permite inyección de comandos ('; rm -rf ~' y similares).",
        "fix": "Usa shell=False pasando el comando como lista de argumentos: subprocess.run(['ls', '-la', ruta]).",
    },
    {
        "key": "sql_concat",
        "pattern": re.compile(r"""(?ix)(?:execute|executemany|raw)\s*\(\s*(?:f["']|["'][^"']*(?:SELECT|INSERT|UPDATE|DELETE)[^"']*["']\s*[+%])"""),
        "severity": "high",
        "category": "security",
        "title": "Posible inyección SQL",
        "explanation": "Se construye una consulta SQL concatenando o interpolando cadenas.",
        "why": "Si alguna variable viene del usuario, puede inyectar SQL arbitrario: leer, modificar o borrar toda la base de datos. Es el ataque #1 histórico del OWASP Top 10.",
        "fix": "Usa consultas parametrizadas: cursor.execute('SELECT ... WHERE id = %s', (user_id,)) o un ORM.",
    },
    {
        "key": "pickle_load",
        "pattern": re.compile(r"pickle\.loads?\s*\("),
        "severity": "high",
        "category": "security",
        "title": "Deserialización insegura (pickle)",
        "explanation": "El archivo deserializa datos con pickle.",
        "why": "Un pickle malicioso ejecuta código arbitrario al cargarse. Nunca deserialices datos que no controles al 100%.",
        "fix": "Para datos externos usa JSON u otro formato declarativo. Reserva pickle solo para datos generados y consumidos por tu propio proceso.",
    },
    {
        "key": "yaml_unsafe",
        "pattern": re.compile(r"yaml\.load\s*\((?![^)]*SafeLoader)"),
        "severity": "medium",
        "category": "security",
        "title": "yaml.load sin SafeLoader",
        "explanation": "Se carga YAML sin el cargador seguro.",
        "why": "yaml.load con el Loader por defecto puede instanciar objetos Python arbitrarios: un YAML malicioso ejecuta código.",
        "fix": "Usa yaml.safe_load(datos) o yaml.load(datos, Loader=yaml.SafeLoader).",
    },
    {
        "key": "weak_hash",
        "pattern": re.compile(r"hashlib\.(md5|sha1)\s*\("),
        "severity": "medium",
        "category": "security",
        "title": "Hash criptográfico débil (MD5/SHA1)",
        "explanation": "Se usa MD5 o SHA-1, algoritmos con colisiones conocidas.",
        "why": "Para contraseñas o firmas, un atacante puede generar colisiones o usar tablas rainbow. MD5 se rompe en segundos con hardware moderno.",
        "fix": "Para contraseñas usa bcrypt/argon2; para integridad usa SHA-256 (hashlib.sha256).",
    },
    {
        "key": "inner_html",
        "pattern": re.compile(r"(?:\.innerHTML\s*=|dangerouslySetInnerHTML)"),
        "severity": "medium",
        "category": "security",
        "title": "Posible XSS (innerHTML)",
        "explanation": "Se inserta HTML directamente en el DOM.",
        "why": "Si el contenido incluye datos del usuario sin sanitizar, un atacante puede inyectar <script> y robar sesiones (Cross-Site Scripting).",
        "fix": "Usa textContent, interpolación de React/Vue (que escapa por defecto) o sanitiza con DOMPurify antes de insertar.",
    },
    {
        "key": "open_cors",
        "pattern": re.compile(r"""allow_origins\s*=\s*\[?\s*["']\*["']"""),
        "severity": "medium",
        "category": "security",
        "title": "CORS abierto a cualquier origen",
        "explanation": "La API acepta peticiones desde cualquier dominio (allow_origins='*').",
        "why": "Cualquier página web puede llamar a tu API desde el navegador de tus usuarios, lo que facilita abusos y filtración de datos si hay cookies o tokens.",
        "fix": "Lista explícitamente los orígenes permitidos (tu dominio de frontend) en la configuración de CORS.",
    },
    {
        "key": "debug_true",
        "pattern": re.compile(r"(?i)debug\s*=\s*True"),
        "severity": "low",
        "category": "security",
        "title": "Modo debug activado",
        "explanation": "Hay una bandera debug=True en el código.",
        "why": "En producción, el modo debug expone trazas de error con rutas, variables y a veces consolas interactivas (Werkzeug) que dan control total del servidor.",
        "fix": "Controla el modo debug con una variable de entorno y asegúrate de que en producción esté apagado.",
    },
    {
        "key": "todo_marker",
        "pattern": re.compile(r"(?:#|//)\s*(?:TODO|FIXME|HACK|XXX)\b"),
        "severity": "info",
        "category": "quality",
        "title": "Deuda técnica marcada (TODO/FIXME)",
        "explanation": "El archivo contiene marcadores TODO, FIXME o HACK.",
        "why": "No es un error, pero es deuda técnica declarada por los propios autores: son los primeros lugares donde buscar bugs y trabajo pendiente.",
        "fix": "Convierte cada marcador en un issue rastreable o resuélvelo. Los TODO eternos se vuelven invisibles.",
    },
]

MAX_MATCHES_PER_RULE_PER_FILE = 5


def scan_content(rel_path: str, content: str) -> List[dict]:
    """Run content rules over one file. Returns raw findings with line numbers."""
    findings = []
    lines = content.splitlines()
    for rule in _CONTENT_RULES:
        count = 0
        for i, line in enumerate(lines, start=1):
            if len(line) > 500:
                continue
            if rule["pattern"].search(line):
                exclude = rule.get("exclude")
                if exclude and exclude.search(line):
                    continue
                findings.append({
                    "rule": rule["key"],
                    "line": i,
                    "snippet": line.strip()[:160],
                })
                count += 1
                if count >= MAX_MATCHES_PER_RULE_PER_FILE:
                    break
    return findings


def _rule_by_key(key: str) -> dict:
    for r in _CONTENT_RULES:
        if r["key"] == key:
            return r
    return {}


# ---------------------------------------------------------------------------
# Stage 2: graph-level detectors + merge
# ---------------------------------------------------------------------------

def build_insights(nodes: List[dict], links: List[dict], node_modules: Dict[str, str],
                   file_findings: Dict[str, List[dict]]) -> dict:
    """
    nodes: [{id, label, metrics{...}, classification{role}}]
    links: [{source, target}]
    file_findings: {node_id: [raw content findings]}
    Returns {"insights": [...], "flagged_links": [(source, target, flag), ...]}
    """
    insights = []
    flagged_links = []
    counter = 0

    def next_id():
        nonlocal counter
        counter += 1
        return f"ins-{counter:03d}"

    g = nx.DiGraph()
    for n in nodes:
        g.add_node(n["id"])
    for l in links:
        g.add_edge(l["source"], l["target"])

    label_of = {n["id"]: n["label"] for n in nodes}

    # --- Circular dependencies -------------------------------------------------
    # Guard: on very dense graphs cycle enumeration can explode; skip it.
    cycles = []
    if len(links) <= 5000:
        try:
            for cyc in nx.simple_cycles(g):
                if 2 <= len(cyc) <= 8:
                    cycles.append(cyc)
                if len(cycles) >= 15:
                    break
        except Exception:
            cycles = []

    for cyc in cycles:
        edges = [(cyc[i], cyc[(i + 1) % len(cyc)]) for i in range(len(cyc))]
        for s, t in edges:
            flagged_links.append({"source": s, "target": t, "flag": "cycle"})
        pretty = " → ".join(label_of.get(x, x) for x in cyc) + f" → {label_of.get(cyc[0], cyc[0])}"
        insights.append({
            "id": next_id(),
            "category": "architecture",
            "severity": "high",
            "title": f"Dependencia circular ({len(cyc)} archivos)",
            "explanation": f"Estos archivos se importan en círculo: {pretty}.",
            "why_matters": "Un ciclo de imports significa que ninguno de estos archivos puede entenderse ni probarse por separado: son un solo bloque disfrazado de varios. Provoca errores de import, dificulta los tests y congela el refactor.",
            "recommendation": "Extrae lo que comparten a un tercer archivo (por ejemplo types.py o utils) del que ambos importen, o invierte una de las dependencias (inyección de dependencias).",
            "nodes": cyc,
            "links": [{"source": s, "target": t} for s, t in edges],
            "evidence": [],
        })

    # --- God files -------------------------------------------------------------
    if nodes:
        degrees = sorted((n["metrics"].get("degree", 0) for n in nodes), reverse=True)
        hub_threshold = max(10, degrees[max(0, int(len(degrees) * 0.05) - 1)] if degrees else 10)
        god_files = [n for n in nodes
                     if n["metrics"].get("degree", 0) >= hub_threshold
                     and n["metrics"].get("complexity", 1) >= 15]
        god_files.sort(key=lambda n: -(n["metrics"].get("degree", 0) * n["metrics"].get("complexity", 1)))
        if len(god_files) <= 5:
            for n in god_files:
                deg = n["metrics"].get("degree", 0)
                cx = n["metrics"].get("complexity", 1)
                insights.append({
                    "id": next_id(),
                    "category": "architecture",
                    "severity": "medium",
                    "title": f"Archivo 'Dios': {n['label']}",
                    "explanation": f"Este archivo tiene {deg} conexiones y complejidad {cx}: concentra demasiada lógica y demasiadas dependencias.",
                    "why_matters": "Cuando medio proyecto depende de un solo archivo enorme, cualquier cambio ahí puede romper todo lo demás. Es el cuello de botella clásico de mantenimiento y la primera fuente de merge conflicts.",
                    "recommendation": "Divídelo por responsabilidades: separa tipos, utilidades y lógica de negocio en archivos propios y deja aquí solo la orquestación.",
                    "nodes": [n["id"]],
                    "links": [],
                    "evidence": [],
                })
        elif god_files:
            insights.append({
                "id": next_id(),
                "category": "architecture",
                "severity": "medium",
                "title": f"{len(god_files)} archivos 'Dios' (muy conectados y complejos)",
                "explanation": "Los peores: " + ", ".join(n["label"] for n in god_files[:6]) + ".",
                "why_matters": "Cuando medio proyecto depende de archivos enormes, cualquier cambio ahí puede romper todo lo demás. Son el cuello de botella clásico de mantenimiento.",
                "recommendation": "Empieza por el primero de la lista: divídelo por responsabilidades y repite con el siguiente.",
                "nodes": [n["id"] for n in god_files],
                "links": [],
                "evidence": [{"file": n["label"], "line": 0,
                              "snippet": f"{n['metrics'].get('degree', 0)} conexiones · complejidad {n['metrics'].get('complexity', 1)}"}
                             for n in god_files[:12]],
            })

    # --- Orphan files ----------------------------------------------------------
    orphans = [n for n in nodes
               if n["metrics"].get("degree", 0) == 0
               and n["classification"].get("role") not in ("entrypoint",)
               and not n["label"].lower().endswith((".md", ".json", ".yml", ".yaml", ".toml", ".css", ".scss", ".html"))]
    if len(orphans) >= 2:
        insights.append({
            "id": next_id(),
            "category": "quality",
            "severity": "low",
            "title": f"{len(orphans)} archivos huérfanos (nadie los importa)",
            "explanation": "Estos archivos de código no importan ni son importados por nadie: "
                           + ", ".join(o["label"] for o in orphans[:8])
                           + ("…" if len(orphans) > 8 else "") + ".",
            "why_matters": "Suelen ser código muerto o scripts sueltos. El código muerto confunde a quien lee el proyecto, sigue apareciendo en búsquedas y puede contener bugs o secretos olvidados.",
            "recommendation": "Confirma si se usan desde fuera (CLI, cron, docs). Si no, bórralos: git guarda la historia y siempre puedes recuperarlos.",
            "nodes": [o["id"] for o in orphans],
            "links": [],
            "evidence": [],
        })

    # --- Giant files -----------------------------------------------------------
    giants = [n for n in nodes if n["metrics"].get("loc", 0) >= 400]
    giants.sort(key=lambda n: -n["metrics"].get("loc", 0))
    if len(giants) <= 5:
        for n in giants:
            loc = n["metrics"].get("loc", 0)
            sev = "high" if loc >= 800 else "medium"
            insights.append({
                "id": next_id(),
                "category": "quality",
                "severity": sev,
                "title": f"Archivo gigante: {n['label']} ({loc} líneas)",
                "explanation": f"Con {loc} líneas, este archivo supera el umbral saludable (~400).",
                "why_matters": "Los archivos gigantes esconden múltiples responsabilidades. Cuesta encontrarlas, probarlas y revisarlas en un PR; la probabilidad de bug por línea crece con el tamaño del archivo.",
                "recommendation": "Busca las 'secciones' naturales del archivo (clases, grupos de funciones) y extráelas a archivos separados dentro del mismo módulo.",
                "nodes": [n["id"]],
                "links": [],
                "evidence": [],
            })
    elif giants:
        worst = giants[0]["metrics"].get("loc", 0)
        insights.append({
            "id": next_id(),
            "category": "quality",
            "severity": "high" if worst >= 800 else "medium",
            "title": f"{len(giants)} archivos gigantes (>400 líneas)",
            "explanation": "Los más grandes: "
                           + ", ".join(f"{n['label']} ({n['metrics'].get('loc', 0)})" for n in giants[:6]) + ".",
            "why_matters": "Los archivos gigantes esconden múltiples responsabilidades. Cuesta encontrarlas, probarlas y revisarlas en un PR; la probabilidad de bug por línea crece con el tamaño.",
            "recommendation": "Ataca primero los de la lista: busca sus secciones naturales (clases, grupos de funciones) y extráelas a archivos separados.",
            "nodes": [n["id"] for n in giants],
            "links": [],
            "evidence": [{"file": n["label"], "line": 0,
                          "snippet": f"{n['metrics'].get('loc', 0)} líneas"} for n in giants[:12]],
        })

    # --- Tangled modules (bidirectional coupling) ------------------------------
    mod_edges = defaultdict(int)
    for l in links:
        sm, tm = node_modules.get(l["source"]), node_modules.get(l["target"])
        if sm and tm and sm != tm:
            mod_edges[(sm, tm)] += 1
    seen_pairs = set()
    for (a, b), cnt in mod_edges.items():
        if (b, a) in mod_edges and frozenset((a, b)) not in seen_pairs:
            seen_pairs.add(frozenset((a, b)))
            back = mod_edges[(b, a)]
            cross = [l for l in links
                     if {node_modules.get(l["source"]), node_modules.get(l["target"])} == {a, b}]
            for l in cross:
                flagged_links.append({"source": l["source"], "target": l["target"], "flag": "tangle"})
            insights.append({
                "id": next_id(),
                "category": "architecture",
                "severity": "medium",
                "title": f"Módulos entrelazados: {a} ↔ {b}",
                "explanation": f"Los módulos '{a}' y '{b}' se importan mutuamente ({cnt} y {back} conexiones).",
                "why_matters": "Cuando dos módulos dependen uno del otro, dejan de ser módulos: no puedes reutilizar, desplegar ni testear uno sin el otro. Las buenas arquitecturas tienen dependencias en un solo sentido (como capas).",
                "recommendation": f"Decide la jerarquía: ¿quién debería estar 'encima'? Mueve el código compartido a un módulo común, y elimina las importaciones en el sentido prohibido.",
                "nodes": [],
                "links": [{"source": l["source"], "target": l["target"]} for l in cross[:30]],
                "evidence": [],
            })

    # --- Content findings (security/quality) -----------------------------------
    grouped = defaultdict(list)  # (rule) -> [(node_id, finding)]
    for node_id, findings in file_findings.items():
        for f in findings:
            grouped[f["rule"]].append((node_id, f))

    for rule_key, items in grouped.items():
        rule = _rule_by_key(rule_key)
        if not rule:
            continue
        affected = sorted({nid for nid, _ in items})
        evidence = [{"file": label_of.get(nid, nid), "line": f["line"], "snippet": f["snippet"]}
                    for nid, f in items[:12]]
        files_txt = ", ".join(label_of.get(a, a) for a in affected[:6]) + ("…" if len(affected) > 6 else "")
        insights.append({
            "id": next_id(),
            "category": rule["category"],
            "severity": rule["severity"],
            "title": f"{rule['title']} · {len(items)} caso(s)",
            "explanation": rule["explanation"] + f" Encontrado en: {files_txt}.",
            "why_matters": rule["why"],
            "recommendation": rule["fix"],
            "nodes": affected,
            "links": [],
            "evidence": evidence,
        })

    insights.sort(key=lambda i: (SEVERITY_ORDER.get(i["severity"], 5), -len(i["nodes"])))
    return {"insights": insights, "flagged_links": flagged_links}


# ---------------------------------------------------------------------------
# Health score
# ---------------------------------------------------------------------------

_PENALTY = {"critical": 15, "high": 8, "medium": 3, "low": 1, "info": 0}


def compute_health(insights: List[dict], node_count: int) -> dict:
    # Diminishing penalty per severity: the first findings weigh full, the
    # rest weigh sqrt — so huge repos aren't automatically flattened to 5.
    counts = defaultdict(int)
    for ins in insights:
        counts[ins["severity"]] += 1
    score = 100.0
    for sev, c in counts.items():
        w = _PENALTY.get(sev, 0)
        if w == 0 or c == 0:
            continue
        full = min(c, 3)
        rest = c - full
        score -= w * (full + rest ** 0.5)
    score = int(max(5, min(100, round(score))))
    if score >= 90:
        grade, verdict = "A", "Proyecto sano. Sigue así."
    elif score >= 75:
        grade, verdict = "B", "Buen estado, con detalles por pulir."
    elif score >= 60:
        grade, verdict = "C", "Funcional, pero acumula deuda. Atiende los hallazgos altos."
    elif score >= 40:
        grade, verdict = "D", "Riesgo alto: hay problemas estructurales o de seguridad."
    else:
        grade, verdict = "F", "Crítico: atiende los hallazgos de seguridad de inmediato."
    return {
        "score": score,
        "grade": grade,
        "verdict": verdict,
        "severity_counts": dict(counts),
    }
