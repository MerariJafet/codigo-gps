
from dataclasses import dataclass, field
from typing import List

@dataclass
class AnalysisOptions:
    ignore_patterns: List[str] = field(default_factory=lambda: [
        ".git", ".venv", "venv", "env", "node_modules", "__pycache__", "dist", "build", ".idea", ".vscode",
        ".pytest_cache", ".next", ".turbo", "coverage", "target", ".mypy_cache", ".ruff_cache"
    ])
    extensions: List[str] = field(default_factory=lambda: [
        ".py", ".js", ".ts", ".tsx", ".jsx", ".css", ".scss", ".html", ".md"
    ])
    include_metrics: bool = True
