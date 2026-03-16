
import ast
import os
import re
from typing import List, Tuple, Dict
from .graph_builder import GraphBuilder
from .config import AnalysisOptions
from .models import Graph

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
    
    for f in files:
        analysis = analyzer.parse_file(f)
        file_analysis_map[f] = analysis
        
        metrics = {
            "loc": analysis.get("loc", 0),
            "complexity": analysis.get("complexity", 1)
        }
        
        node_id = builder.add_file_node(f, repo_path, metrics)
        file_id_map[f] = node_id

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
                    
    # 6. Construir y retornar grafo
    return builder.build()

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
        # simplistic match: replace . with / and look for suffix
        expected_suffix = imp.replace(".", "/") + ".py"
        for potential in all_files:
            if potential.endswith(expected_suffix):
                 return potential
    
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
        return {}

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
                "complexity": len(classes) + len(functions) + 1
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
                "complexity": len(classes) + len(functions) + 1
            }
        except Exception:
            return {"imports": [], "classes": [], "functions": [], "loc": 0}
