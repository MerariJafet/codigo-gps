from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class FolderInfo(BaseModel):
    full_path: str
    dir_path: str
    root_folder: str
    segments: List[str]

class Node(BaseModel):
    id: str
    type: str  # 'file', 'class', 'function', 'module'
    label: str
    metrics: Dict[str, Any] = {}
    classification: Dict[str, Any] = {} # { "layer": str, "role": str }
    folders: Optional[FolderInfo] = None

class Edge(BaseModel):
    source: str
    target: str
    relation: str  # 'imports', 'calls', 'inherits'

class GraphData(BaseModel):
    nodes: List[Node]
    links: List[Edge]

class AnalysisRequest(BaseModel):
    repo_path: str
    branch: Optional[str] = "main"
