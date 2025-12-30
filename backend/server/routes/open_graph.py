import os
import uuid
import json
import webbrowser
import dataclasses
from fastapi import APIRouter, HTTPException, Depends
from ..schemas import AnalyzeRequest
from ...core import analyze_repo
from ..utils import validate_repo_path
from ..auth import get_current_user_permissive
from ..rate_limiter import rate_limit_dependency
from ..logger import logger

router = APIRouter(dependencies=[Depends(get_current_user_permissive), Depends(rate_limit_dependency)])

# Storage Configuration
STORAGE_DIR = "/tmp/codigo_gps_graphs"
if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR, exist_ok=True)
    os.chmod(STORAGE_DIR, 0o700) # Secure storage

@router.post("/open-graph")
def open_graph(request: AnalyzeRequest):
    logger.info(f"Open Graph request for: {request.repo_path}")
    repo_path = validate_repo_path(request.repo_path)
    repo_path_str = str(repo_path)

    try:
        graph = analyze_repo(repo_path_str)
        
        graph_id = str(uuid.uuid4())
        file_path = os.path.join(STORAGE_DIR, f"{graph_id}.json")
        
        graph_dict = dataclasses.asdict(graph)
        with open(file_path, "w") as f:
            json.dump(graph_dict, f)
            
        frontend_url = f"http://127.0.0.1:3000/?graph_id={graph_id}"
        webbrowser.open(frontend_url)
        
        return {
            "status": "OK",
            "graph_id": graph_id,
            "url": frontend_url
        }
    except Exception as e:
        logger.error(f"Open Graph failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
