
from pydantic import BaseModel
from typing import List, Optional, Any

class FolderInfoSchema(BaseModel):
    full_path: str
    dir_path: str
    root_folder: str
    segments: List[str]

class ClassificationSchema(BaseModel):
    layer: str
    role: str
    flags: List[str] = []

class MetricsSchema(BaseModel):
    loc: int
    complexity: float
    degree: int
    in_degree: int
    out_degree: int

class NodeSchema(BaseModel):
    id: str
    label: str
    path: str
    type: str
    metrics: MetricsSchema
    classification: ClassificationSchema
    folders: FolderInfoSchema

class LinkSchema(BaseModel):
    source: str
    target: str
    relation: str

class GraphSchema(BaseModel):
    nodes: List[NodeSchema]
    links: List[LinkSchema]

    class Config:
        json_schema_extra = {
            "example": {
                "nodes": [],
                "links": []
            }
        }

class FileManifestEntry(BaseModel):
    path: str
    content: str
    size: int

class AnalyzeRequest(BaseModel):
    repo_path: Optional[str] = None
    file_manifest: Optional[List[FileManifestEntry]] = None
    options: Optional[dict] = None

    class Config:
        json_schema_extra = {
            "example": {
                "repo_path": ".",
                "options": {
                    "ignore_patterns": ["node_modules", "venv"],
                    "extensions": [".py", ".ts"]
                }
            }
        }
