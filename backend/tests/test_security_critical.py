import pytest
import os
import zipfile
from pathlib import Path
from fastapi import HTTPException
from backend.server.utils import validate_repo_path, safe_extract
from backend.server.sandbox import create_temp_workdir, ensure_sandbox_root

# Mock home for tests if needed, or use actual home
# We will use actual logic but expect failures for obviously bad paths

def test_validate_repo_path_success():
    # Helper: Create a dummy dir in home for testing
    test_dir = Path.home() / "codigo_gps_test_dir"
    test_dir.mkdir(exist_ok=True)
    try:
        # Should succeed
        validated = validate_repo_path(str(test_dir))
        assert validated == test_dir.resolve()
    finally:
        test_dir.rmdir()

def test_validate_repo_path_traversal():
    # Attempt to go to root
    with pytest.raises(HTTPException) as excinfo:
        # Assuming user is not root and /etc is not in allowlist (Path.home())
        validate_repo_path("/etc")
    assert excinfo.value.status_code == 403

def test_zip_slip_prevention():
    # Create a malicious zip in memory
    zip_path = Path("malicious.zip")
    with zipfile.ZipFile(zip_path, 'w') as zf:
        # Add file with traversal path
        zf.writestr('../../../evil.txt', 'evil content')
    
    extract_dir = Path("extract_test")
    extract_dir.mkdir(exist_ok=True)
    
    try:
        with pytest.raises(Exception) as excinfo:
            safe_extract(zip_path, extract_dir)
        assert "Unsafe ZIP entry" in str(excinfo.value)
    finally:
        if zip_path.exists(): os.remove(zip_path)
        if extract_dir.exists(): extract_dir.rmdir()

def test_sandbox_permissions():
    root = ensure_sandbox_root()
    # Check permissions are 700 (rwx------)
    # stat.S_IMODE gets the permission bits
    mode = os.stat(root).st_mode
    assert (mode & 0o777) == 0o700

def test_create_temp_workdir():
    temp_dir = create_temp_workdir("test_")
    assert temp_dir.exists()
    assert str(temp_dir).startswith(str(ensure_sandbox_root()))
    # Cleanup
    os.rmdir(temp_dir)
