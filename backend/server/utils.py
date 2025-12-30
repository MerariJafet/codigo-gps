from pathlib import Path
from fastapi import HTTPException
import os
import zipfile

# Define allowed root (default to user home for maximum utility but restricted to user space)
BASE_ALLOWED_DIR = Path.home().resolve()

def validate_repo_path(repo_path: str) -> Path:
    """
    Normalizes and validates repo_path to prevent path traversal.
    Ensures path is within BASE_ALLOWED_DIR.
    """
    try:
        path = Path(repo_path).expanduser().resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path format.")

    # Check for path existence
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {repo_path}")
    
    if not path.is_dir():
         raise HTTPException(status_code=400, detail=f"Path is not a directory: {repo_path}")

    # Prevent escaping allowed root
    if not str(path).startswith(str(BASE_ALLOWED_DIR)):
         raise HTTPException(
            status_code=403, 
            detail=f"Path must be within allowed workspace ({BASE_ALLOWED_DIR})"
        )
        
    return path

def safe_extract(zip_file_path: Path, target_dir: Path) -> Path:
    """
    Safely extracts a zip file, preventing Zip Slip attacks.
    """
    target_dir = target_dir.resolve()
    
    with zipfile.ZipFile(zip_file_path, 'r') as zf:
        for member in zf.infolist():
            # Resolve target path for this member
            target_path = (target_dir / member.filename).resolve()
            
            # Check if target_path is within target_dir
            if not str(target_path).startswith(str(target_dir)):
                 raise Exception(f"Unsafe ZIP entry detected (Zip Slip attempt): {member.filename}")
        
        # If safe, extract
        zf.extractall(target_dir)
        
    return target_dir
