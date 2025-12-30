from fastapi import APIRouter, HTTPException, Query
import os
import platform
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()

class FileEntry(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: Optional[int] = 0

class DirectoryListing(BaseModel):
    path: str
    parent: Optional[str]
    entries: List[FileEntry]
    error: Optional[str] = None

@router.get("/system/ls", response_model=DirectoryListing)
def list_directory(path: Optional[str] = None):
    """
    List contents of a directory.
    If path is None, defaults to current working directory or Home.
    """
    if not path:
        path = os.path.expanduser("~")
    
    # Normalize path
    path = os.path.abspath(path)
    
    if not os.path.exists(path):
        return DirectoryListing(
            path=path,
            parent=os.path.dirname(path),
            entries=[],
            error="Path does not exist"
        )
        
    if not os.path.isdir(path):
        return DirectoryListing(
            path=path,
            parent=os.path.dirname(path),
            entries=[],
            error="Not a directory"
        )

    entries = []
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    entries.append(FileEntry(
                        name=entry.name,
                        path=entry.path,
                        is_dir=entry.is_dir(),
                        size=entry.stat().st_size if not entry.is_dir() else 0
                    ))
                except OSError:
                    continue # Skip entries we can't access
                    
        # Sort: Directories first, then files
        entries.sort(key=lambda x: (not x.is_dir, x.name.lower()))
        
    except PermissionError:
        return DirectoryListing(
            path=path,
            parent=os.path.dirname(path),
            entries=[],
            error="Permission denied"
        )
    except Exception as e:
         return DirectoryListing(
            path=path,
            parent=os.path.dirname(path),
            entries=[],
            error=str(e)
        )

    return DirectoryListing(
        path=path,
        parent=os.path.dirname(path),
        entries=entries
    )

@router.get("/system/validate", response_model=dict)
def validate_path(path: str = Query(...)):
    """Check if a path exists and is a directory."""
    exists = os.path.exists(path)
    is_dir = os.path.isdir(path) if exists else False
    return {"exists": exists, "is_dir": is_dir, "path": path}
