
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

def _resolve_import(imp: str, source_file: str, current_dir: str, all_files: List[str], options: AnalysisOptions) -> str | None:
    # Python linking strategy
    if source_file.endswith(".py"):
        # defined in backend/core/graph.py -> backend.core.graph
        # match on path-segment boundary to avoid e.g. "modules.py" matching "test_modules.py"
        expected_suffix = imp.replace(".", "/") + ".py"
        candidates = [p for p in all_files
                      if p.endswith("/" + expected_suffix) or p == expected_suffix]
        if candidates:
            # prefer the candidate sharing the deepest directory with the source file
            def shared_prefix(p: str) -> int:
                a, b = p.split("/"), source_file.split("/")
                n = 0
                while n < min(len(a), len(b)) and a[n] == b[n]:
                    n += 1
                return n
            return max(candidates, key=shared_prefix)
    
    # JS/TS linking strategy
    elif source_file.split('.')[-1] in ['js', 'ts', 'jsx', 'tsx']:
        # Handle relative imports
        if imp.startswith('.'):
            # Resolve path
            resolved_path = os.path.normpath(os.path.join(current_dir, imp))
            
            # Try to find exact match with extensions
            # Priority: defined extension -> implicit extensions -> index files
            candidates = [resolved_path + ext for ext in options.extensions if ext in ['.ts', '.tsx', '.js', '.jsx']]
            candidates.extend([os.path.join(resolved_path, "index" + ext) for ext in options.extensions if ext in ['.ts', '.tsx', '.js', '.jsx']])
            candidates.append(resolved_path) # Exact match or already has extension

            for cand in candidates:
                if cand in all_files:
                    return cand
                    
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
                    if node.module:
                        imports.append(node.module)
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
                "findings": scan_content(file_path, content)
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
                "findings": scan_content(file_path, content)
            }
        except Exception:
            return {"imports": [], "classes": [], "functions": [], "loc": 0}
