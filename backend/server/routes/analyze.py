from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from ..schemas import AnalyzeRequest, GraphSchema
from ...core import analyze_repo
from ...core.config import AnalysisOptions
from ..utils import validate_repo_path, safe_extract
from ..sandbox import create_temp_workdir
from ..auth import get_current_user_permissive
from ..rate_limiter import rate_limit_dependency, get_concurrency_limiter
from ..logger import logger
import shutil
import asyncio

router = APIRouter(dependencies=[Depends(get_current_user_permissive), Depends(rate_limit_dependency)])

@router.post("/analyze", response_model=GraphSchema)
async def analyze(request: AnalyzeRequest, semaphore: asyncio.Semaphore = Depends(get_concurrency_limiter)):
    async with semaphore:
        logger.info(f"Analyze request for: {request.repo_path or 'file_manifest'}")
        
        if request.repo_path:
            # Original repo_path flow
            repo_path = validate_repo_path(request.repo_path)
            repo_path_str = str(repo_path)
        elif request.file_manifest:
            # Web mode: file manifest flow
            # For now, create a temporary directory and write files
            import tempfile
            import os
            temp_dir = tempfile.mkdtemp()
            for file_entry in request.file_manifest:
                file_path = os.path.join(temp_dir, file_entry.path)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(file_entry.content)
            repo_path_str = temp_dir
        else:
            raise HTTPException(status_code=400, detail="Either repo_path or file_manifest must be provided")
    
        # Build options
        options = None
        if request.options:
            options = AnalysisOptions()
            if "ignore_patterns" in request.options:
                 options.ignore_patterns = request.options["ignore_patterns"]
            if "extensions" in request.options:
                 options.extensions = request.options["extensions"]
    
        try:
            # Running synchronous analysis in threadpool to allow async semaphore release if needed,
            # though here we are just blocking this request. 
            # Ideally analyze_repo should be async or run_in_executor.
            # For simplicity in this refactor, we keep it direct but shielded by semaphore.
            graph = analyze_repo(repo_path_str, options)
            return graph
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-zip", response_model=GraphSchema)
async def analyze_zip(file: UploadFile = File(...), semaphore: asyncio.Semaphore = Depends(get_concurrency_limiter)):
    async with semaphore:
        logger.info(f"Zip analysis request: {file.filename}")
        temp_dir = create_temp_workdir("zip_analysis_")
        zip_path = temp_dir / file.filename
        
        try:
            with open(zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            extract_root = safe_extract(zip_path, temp_dir)
            graph = analyze_repo(str(extract_root))
            return graph
            
        except Exception as e:
            logger.error(f"Zip analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"Zip analysis failed: {e}")
        finally:
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
