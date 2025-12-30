
from fastapi import APIRouter, HTTPException, File, UploadFile
from .schemas import AnalyzeRequest, GraphSchema
from backend.core import analyze_repo
from backend.core.config import AnalysisOptions
from .utils import validate_repo_path, safe_extract
from .sandbox import create_temp_workdir
import shutil
import os
import uuid
import json
import webbrowser
import dataclasses

router_v1 = APIRouter(prefix="/api/v1")

# Storage Configuration
STORAGE_DIR = "/tmp/codigo_gps_graphs"
os.makedirs(STORAGE_DIR, exist_ok=True)

@router_v1.get("/health")
def health():
    return {"status": "ok", "service": "codigo-gps", "version": "1.0.0"}

@router_v1.post("/open-graph")
def open_graph(request: AnalyzeRequest):
    repo_path = validate_repo_path(request.repo_path)
    # validate_repo_path returns a Path object, ensure analyze_repo handles it or convert to str
    repo_path_str = str(repo_path)

    try:
        # Analyze
        graph = analyze_repo(repo_path_str)
        
        # Save to storage
        graph_id = str(uuid.uuid4())
        file_path = os.path.join(STORAGE_DIR, f"{graph_id}.json")
        
        graph_dict = dataclasses.asdict(graph)
        with open(file_path, "w") as f:
            json.dump(graph_dict, f)
            
        # Construct URL (assuming default port 3000 for frontend)
        # TODO: Make port configurable via environment or args? keeping 3000 for now as per prompt
        frontend_url = f"http://127.0.0.1:3000/?graph_id={graph_id}"
        
        # Open Browser
        webbrowser.open(frontend_url)
        
        return {
            "status": "OK",
            "graph_id": graph_id,
            "url": frontend_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router_v1.get("/graphs/{graph_id}", response_model=GraphSchema)
def get_graph(graph_id: str):
    file_path = os.path.join(STORAGE_DIR, f"{graph_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Graph not found")
        
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load graph")


@router_v1.post("/analyze", response_model=GraphSchema)
def analyze(request: AnalyzeRequest):
    repo_path = validate_repo_path(request.repo_path)
    repo_path_str = str(repo_path)

    # Build options
    options = None
    if request.options:
        # Simple mapping for now, could be more robust
        options = AnalysisOptions()
        if "ignore_patterns" in request.options:
             options.ignore_patterns = request.options["ignore_patterns"]
        if "extensions" in request.options:
             options.extensions = request.options["extensions"]

    try:
        graph = analyze_repo(repo_path_str, options)
        return graph
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Alias for legacy frontend
@router_v1.post("/legacy/analyze", response_model=GraphSchema)
def analyze_legacy(request: AnalyzeRequest):
    return analyze(request)

@router_v1.post("/analyze-zip", response_model=GraphSchema)
def analyze_zip(file: UploadFile = File(...)):
    # Create secure temp dir in sandbox
    temp_dir = create_temp_workdir("zip_analysis_")
    
    zip_path = temp_dir / file.filename
    
    try:
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Safe Extract
        extract_root = safe_extract(zip_path, temp_dir)
        
        # Analyze
        graph = analyze_repo(str(extract_root))
        return graph
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Zip analysis failed: {e}")
    finally:
        # Cleanup
    finally:
        # Cleanup
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
