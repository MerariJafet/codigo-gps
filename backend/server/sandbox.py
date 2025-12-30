from pathlib import Path
import tempfile
import os
import stat

SANDBOX_ROOT = Path.home() / ".codigo_gps" / "tmp"

def ensure_sandbox_root() -> Path:
    """
    Ensures the sandbox root exists with restricted permissions (700).
    """
    if not SANDBOX_ROOT.exists():
        SANDBOX_ROOT.mkdir(parents=True)
    
    # Enforce strict permissions (rwx------)
    os.chmod(SANDBOX_ROOT, stat.S_IRWXU)
    return SANDBOX_ROOT

def create_temp_workdir(prefix: str = "work_") -> Path:
    """
    Creates a secure temporary directory within the sandbox.
    """
    root = ensure_sandbox_root()
    path = Path(tempfile.mkdtemp(prefix=prefix, dir=root))
    return path
