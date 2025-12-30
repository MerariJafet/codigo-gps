
from dataclasses import dataclass
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

@dataclass
class Link:
    source: str
    target: str
    relation: str     # "imports"

@dataclass
class Graph:
    nodes: list[Node]
    links: list[Link]
