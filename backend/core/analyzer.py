
import ast
import dataclasses
import os
import re
from collections import defaultdict
from typing import List, Tuple, Dict
from .graph_builder import GraphBuilder
from .config import AnalysisOptions
from .models import Graph
from .modules import build_modules, LANG_BY_EXT
from .insights import scan_content, build_insights, compute_health

def analyze_repo(repo_path: str | None = None, file_manifest: List[Dict] | None = None, options: AnalysisOptions | None = None) -> Graph:
    """
    Analiza un repositorio de código y regresa un objeto Graph con:
    - nodes: archivos (con métricas, clasificación, folders)
    - links: conexiones/imports entre archivos
    """
    if options is None:
        options = AnalysisOptions()
        
    # 1. Normalizar repo_path
    repo_path = os.path.abspath(repo_path)
    if not os.path.exists(repo_path):
        raise ValueError(f"Repository path not found: {repo_path}")

    # 2. Escanear archivos
    files = _scan_files(repo_path, options)
    
    # 3. Inicializar componentes
    analyzer = CodeAnalyzer()
    builder = GraphBuilder()
    
    # 4. Primer pase: Nodos y Métricas
    file_id_map = {} # full_path -> node_id
    file_analysis_map = {} # full_path -> analysis_result
    file_findings = {} # node_id -> [content findings]

    for f in files:
        analysis = analyzer.parse_file(f)
        file_analysis_map[f] = analysis

        metrics = {
            "loc": analysis.get("loc", 0),
            "complexity": analysis.get("complexity", 1)
        }

        node_id = builder.add_file_node(f, repo_path, metrics)
        file_id_map[f] = node_id
        if analysis.get("findings"):
            file_findings[node_id] = analysis["findings"]

    # 5. Segundo pase: Links / Import resolution
    for f, analysis in file_analysis_map.items():
        source_id = file_id_map[f]
        current_dir = os.path.dirname(f)

        for imp in analysis.get("imports", []):
            target_path = _resolve_import(imp, f, current_dir, files, options)

            if target_path and target_path in file_id_map:
                target_id = file_id_map[target_path]
                if source_id != target_id:
                    builder.add_dependency(source_id, target_id, "imports")

    # 5b. Puentes HTTP: llamadas fetch/axios del frontend → rutas del backend
    route_map = {}  # normalized route path -> [file paths]
    for f, analysis in file_analysis_map.items():
        for route in analysis.get("api_routes", []):
            route_map.setdefault(route, []).append(f)

    for f, analysis in file_analysis_map.items():
        source_id = file_id_map[f]
        for call in set(analysis.get("api_calls", [])):
            for target_path in route_map.get(call, []):
                target_id = file_id_map[target_path]
                if source_id != target_id and not builder.graph.has_edge(source_id, target_id):
                    builder.add_dependency(source_id, target_id, "api_call")

    # 6. Construir grafo base
    graph = builder.build()

    # 7. Capa de inteligencia: módulos, insights y resumen
    return _enrich_graph(graph, file_findings)


def _enrich_graph(graph: Graph, file_findings: Dict[str, List[dict]]) -> Graph:
    """Adds modules (blocks), insights (analyst+teacher) and summary to the graph."""
    node_dicts = [dataclasses.asdict(n) for n in graph.nodes]
    link_dicts = [dataclasses.asdict(l) for l in graph.links]

    # Modules / blocks
    mod_data = build_modules(node_dicts, link_dicts)
    node_modules = mod_data["node_modules"]
    for n in graph.nodes:
        n.module = node_modules.get(n.id, "root")
    graph.modules = mod_data["modules"]
    graph.module_links = mod_data["module_links"]

    # Insights
    ins_data = build_insights(node_dicts, link_dicts, node_modules, file_findings)
    graph.insights = ins_data["insights"]

    # Flag links (cycles / tangles / cross-module)
    flag_map = defaultdict(set)
    for fl in ins_data["flagged_links"]:
        flag_map[(fl["source"], fl["target"])].add(fl["flag"])
    for l in graph.links:
        flags = set(flag_map.get((l.source, l.target), set()))
        sm, tm = node_modules.get(l.source), node_modules.get(l.target)
        if sm and tm and sm != tm:
            flags.add("cross_module")
        if l.relation == "api_call":
            flags.add("api")
        l.flags = sorted(flags)

    # Summary
    health = compute_health(graph.insights, len(graph.nodes))
    lang_stats = defaultdict(lambda: {"files": 0, "loc": 0})
    total_loc = 0
    complexities = []
    for n in graph.nodes:
        ext = os.path.splitext(n.label)[1].lower()
        lang = LANG_BY_EXT.get(ext, "Otro")
        lang_stats[lang]["files"] += 1
        lang_stats[lang]["loc"] += n.metrics.loc
        total_loc += n.metrics.loc
        complexities.append(n.metrics.complexity)

    buckets = {"Simple (≤5)": 0, "Media (6-15)": 0, "Alta (16-30)": 0, "Muy alta (>30)": 0}
    for c in complexities:
        if c <= 5: buckets["Simple (≤5)"] += 1
        elif c <= 15: buckets["Media (6-15)"] += 1
        elif c <= 30: buckets["Alta (16-30)"] += 1
        else: buckets["Muy alta (>30)"] += 1

    top_hubs = sorted(graph.nodes, key=lambda n: -n.metrics.degree)[:8]

    graph.summary = {
        "total_files": len(graph.nodes),
        "total_links": len(graph.links),
        "total_modules": len(graph.modules),
        "total_loc": total_loc,
        "avg_complexity": round(sum(complexities) / len(complexities), 1) if complexities else 0,
        "health": health,
        "languages": [
            {"name": k, "files": v["files"], "loc": v["loc"]}
            for k, v in sorted(lang_stats.items(), key=lambda kv: -kv[1]["loc"])
        ],
        "complexity_buckets": [{"label": k, "count": v} for k, v in buckets.items()],
        "top_hubs": [
            {"id": n.id, "label": n.label, "degree": n.metrics.degree,
             "complexity": n.metrics.complexity, "module": n.module}
            for n in top_hubs
        ],
        "cycles_count": sum(1 for i in graph.insights if "circular" in i["title"].lower()),
    }
    return graph

def _scan_files(repo_path: str, options: AnalysisOptions) -> List[str]:
    files = []
    for root, dirs, filenames in os.walk(repo_path):
        # Filter directories in place
        dirs[:] = [d for d in dirs if d not in options.ignore_patterns]
        
        for name in filenames:
            _, ext = os.path.splitext(name)
            if ext in options.extensions:
                files.append(os.path.join(root, name))
    return files

def _shared_prefix_len(p: str, source_file: str) -> int:
    a, b = p.split("/"), source_file.split("/")
    n = 0
    while n < min(len(a), len(b)) and a[n] == b[n]:
        n += 1
    return n


def _best_suffix_match(suffixes: List[str], source_file: str, all_files: List[str]) -> str | None:
    """Find the file matching any suffix on a path-segment boundary,
    preferring the candidate closest to the importing file."""
    candidates = [p for p in all_files
                  if any(p.endswith("/" + s) or p == s for s in suffixes)]
    if not candidates:
        return None
    return max(candidates, key=lambda p: _shared_prefix_len(p, source_file))


_JS_EXTS = ['.ts', '.tsx', '.js', '.jsx']
# Common path-alias prefixes (tsconfig "paths", Expo/Next conventions)
_JS_ALIAS_PREFIXES = ('@/', '~/', 'src/', 'app/', 'components/', 'lib/', 'utils/')


def _resolve_import(imp: str, source_file: str, current_dir: str, all_files: List[str], options: AnalysisOptions) -> str | None:
    # Python linking strategy
    if source_file.endswith(".py"):
        if imp.startswith("."):
            # Relative import: climb one dir per extra dot beyond the first
            dots = len(imp) - len(imp.lstrip("."))
            rest = imp[dots:]
            base = current_dir
            for _ in range(dots - 1):
                base = os.path.dirname(base)
            target = os.path.join(base, rest.replace(".", "/")) if rest else base
            for cand in (target + ".py", os.path.join(target, "__init__.py")):
                cand = os.path.normpath(cand)
                if cand in all_files:
                    return cand
            return None
        # Absolute import: boundary-suffix match (module or its package __init__)
        mod_path = imp.replace(".", "/")
        return _best_suffix_match([mod_path + ".py", mod_path + "/__init__.py"],
                                  source_file, all_files)

    # JS/TS linking strategy
    elif source_file.split('.')[-1] in ['js', 'ts', 'jsx', 'tsx']:
        exts = [e for e in options.extensions if e in _JS_EXTS] or _JS_EXTS

        # Relative imports: exact resolution
        if imp.startswith('.'):
            resolved_path = os.path.normpath(os.path.join(current_dir, imp))
            candidates = [resolved_path + ext for ext in exts]
            candidates.extend([os.path.join(resolved_path, "index" + ext) for ext in exts])
            candidates.append(resolved_path)
            for cand in candidates:
                if cand in all_files:
                    return cand
            return None

        # Alias imports (@/components/X, ~/lib/y, src/z...): fuzzy suffix match
        rest = None
        for prefix in _JS_ALIAS_PREFIXES:
            if imp.startswith(prefix):
                rest = imp[len(prefix):] if prefix in ('@/', '~/') else imp
                break
        if rest:
            suffixes = [rest + ext for ext in exts]
            suffixes.extend([rest + "/index" + ext for ext in exts])
            return _best_suffix_match(suffixes, source_file, all_files)
        # Bare imports (react, expo, fastapi...) are external packages: ignore

    return None

class CodeAnalyzer:
    def parse_file(self, file_path: str) -> dict:
        """
        Returns structure: { 'imports': [], 'classes': [], 'functions': [] }
        """
        ext = os.path.splitext(file_path)[1]
        if ext == '.py':
            return self._parse_python(file_path)
        elif ext in ['.js', '.ts', '.jsx', '.tsx']:
            return self._parse_js_basic(file_path)
        return self._parse_generic(file_path)

    def _parse_generic(self, file_path: str):
        """Non-code files (css, html, md...): count lines and scan for markers."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            return {
                "imports": [], "classes": [], "functions": [],
                "loc": len(content.splitlines()),
                "complexity": 1,
                "findings": scan_content(file_path, content)
            }
        except Exception:
            return {"imports": [], "classes": [], "functions": [], "loc": 0}

    def _parse_python(self, file_path: str):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            tree = ast.parse(content)
            
            imports = []
            classes = []
            functions = []

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    level = "." * (node.level or 0)
                    if node.module:
                        imports.append(level + node.module)
                    else:
                        # "from . import x, y" — each name is a sibling module
                        for alias in node.names:
                            imports.append(level + alias.name)
                elif isinstance(node, ast.ClassDef):
                    classes.append(node.name)
                elif isinstance(node, ast.FunctionDef):
                    functions.append(node.name)
            
            return {
                "imports": imports,
                "classes": classes,
                "functions": functions,
                "loc": len(content.splitlines()),
                "complexity": len(classes) + len(functions) + 1,
                "findings": scan_content(file_path, content),
                "api_routes": _extract_api_routes(content)
            }
        except Exception:
            return {"imports": [], "classes": [], "functions": [], "loc": 0}

    def _parse_js_basic(self, file_path: str):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            imports = []
            # Regex for static imports: import ... from '...'
            # Matches: import { X } from 'path'; import X from "path";
            import_patterns = [
                r'import\s+.*?\s+from\s+[\'"](.*?)[\'"]',
                r'require\s*\(\s*[\'"](.*?)[\'"]\s*\)', # Common in JS/Node
                r'import\s*\(\s*[\'"](.*?)[\'"]\s*\)'   # Dynamic imports
            ]
            
            for pattern in import_patterns:
                matches = re.findall(pattern, content)
                imports.extend(matches)

            # Very basic class/function detection via regex
            classes = re.findall(r'class\s+(\w+)', content)
            function_patterns = [
                r'function\s+(\w+)',
                r'const\s+(\w+)\s*=\s*\(.*?\)\s*=>', # const foo = () => {}
                r'const\s+(\w+)\s*=\s*function'      # const foo = function()
            ]
            functions = []
            for pat in function_patterns:
                functions.extend(re.findall(pat, content))

            return {
                "imports": imports,
                "classes": classes,
                "functions": functions,
                "loc": len(content.splitlines()),
                "complexity": len(classes) + len(functions) + 1,
                "findings": scan_content(file_path, content),
                "api_calls": _extract_api_calls(content)
            }
        except Exception:
            return {"imports": [], "classes": [], "functions": [], "loc": 0}


# ---------------------------------------------------------------------------
# HTTP bridge detection: FastAPI/Flask route declarations in the backend
# matched against fetch/axios URL literals in the frontend.
# ---------------------------------------------------------------------------

_ROUTE_RE = re.compile(r"""@\w+\.(?:get|post|put|delete|patch|websocket)\(\s*['"]([^'"]+)['"]""")
_CALL_LINE_RE = re.compile(r"""fetch|axios|apiClient|api\.|\.get\(|\.post\(|\.put\(|\.delete\(|\.patch\(|request\(""", re.I)
_URL_RE = re.compile(r"""['"`](/[A-Za-z0-9_\-/{}:$.]+)['"`]|`([^`]*?)(/[A-Za-z0-9_\-/{}:$.]+)`""")
_PARAM_SEG_RE = re.compile(r"\{[^}]*\}|:[A-Za-z_]+|\$\{[^}]*\}")


def _normalize_api_path(path: str) -> str:
    path = path.split("?")[0].rstrip("/").lower()
    path = _PARAM_SEG_RE.sub("*", path)
    # strip common mount prefixes so "/api/v1/pets" matches route "/pets"
    for prefix in ("/api/v1", "/api/v2", "/api"):
        if path.startswith(prefix + "/"):
            path = path[len(prefix):]
            break
    return path or "/"


def _extract_api_routes(content: str) -> List[str]:
    return [_normalize_api_path(r) for r in _ROUTE_RE.findall(content)]


def _extract_api_calls(content: str) -> List[str]:
    calls = []
    for line in content.splitlines():
        if len(line) > 500 or not _CALL_LINE_RE.search(line):
            continue
        for m in _URL_RE.finditer(line):
            url = m.group(1) or m.group(3)
            if url and len(url) > 1 and not url.startswith("//"):
                calls.append(_normalize_api_path(url))
    return calls
