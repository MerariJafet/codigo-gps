import os
import json
from fastapi import APIRouter, HTTPException, Depends
from ..schemas import GraphSchema
from ..auth import get_current_user_permissive
from ..logger import logger

router = APIRouter(dependencies=[Depends(get_current_user_permissive)])

STORAGE_DIR = "/tmp/codigo_gps_graphs"

@router.get("/graphs/{graph_id}", response_model=GraphSchema)
def get_graph(graph_id: str):
    file_path = os.path.join(STORAGE_DIR, f"{graph_id}.json")
    if not os.path.exists(file_path):
        logger.warning(f"Graph not found: {graph_id}")
        raise HTTPException(status_code=404, detail="Graph not found")
        
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Failed to load graph {graph_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load graph")
