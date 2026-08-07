
from dataclasses import dataclass, field
from typing import List, Dict, Optional

@dataclass
class FolderInfo:
    full_path: str
    dir_path: str
    root_folder: str
    segments: list[str]

@dataclass
class Classification:
    layer: str        # backend | frontend | shared | config | test | unknown
    role: str         # entrypoint | core_hub | leaf | orphan
    flags: list[str]

@dataclass
class Metrics:
    loc: int
    complexity: float
    degree: int
    in_degree: int
    out_degree: int

@dataclass
class Node:
    id: str           # ej: "file:backend/main.py"
    label: str        # ruta corta para UI
    path: str         # ruta completa
    type: str         # "file"
    metrics: Metrics
    classification: Classification
    folders: FolderInfo
    module: str = ""  # módulo/bloque lógico asignado (ej: "backend/core")

@dataclass
class Link:
    source: str
    target: str
    relation: str     # "imports"
    flags: list[str] = field(default_factory=list)  # "cycle" | "tangle" | "cross_module"

@dataclass
class Graph:
    nodes: list[Node]
    links: list[Link]
    modules: list[dict] = field(default_factory=list)
    module_links: list[dict] = field(default_factory=list)
    insights: list[dict] = field(default_factory=list)
    summary: dict = field(default_factory=dict)
