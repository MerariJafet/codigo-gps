import secrets
import json
import os
from pathlib import Path
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .logger import logger

CONFIG_DIR = Path.home() / ".codigo_gps"
CONFIG_FILE = CONFIG_DIR / "config.json"
security = HTTPBearer()

def get_or_create_token() -> str:
    if not CONFIG_DIR.exists():
        CONFIG_DIR.mkdir(parents=True)
        os.chmod(CONFIG_DIR, 0o700)
        
    token = None
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                config = json.load(f)
                token = config.get("auth_token")
        except Exception as e:
            logger.error(f"Error reading config: {e}")

    if not token:
        # Generate new token
        token = secrets.token_hex(32)
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump({"auth_token": token}, f)
            # Secure config file
            os.chmod(CONFIG_FILE, 0o600)
            logger.info("Generated new auth token")
        except Exception as e:
            logger.error(f"Error writing config: {e}")
            
    return token

# Load token into memory
SERVER_TOKEN = get_or_create_token()

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates the Bearer token.
    Allows localhost bypass in Dev Mode if configured, or soft-fail for now as requested.
    """
    token = credentials.credentials
    
    if token == SERVER_TOKEN:
        return True
        
    # Dev Mode / Localhost Exception Logic (Optional but recommended for strictness, user asked for permissive 127.0.0.1)
    # However, HTTPBearer will likely Raise 403 if no header is present BEFORE this function is called.
    # To handle the "no header but localhost" case, we might need a custom dependency that accepts 'None'.
    # For standard Bearer auth, the client MUST send the header.
    
    # Strict check
    logger.warning(f"Invalid token attempt from {request.client.host}")
    raise HTTPException(status_code=401, detail="Invalid authentication token")

async def get_current_user_permissive(request: Request):
    """
    Permissive auth for Dev Mode: 
    Checks header. If missing/invalid but IP is localhost, allow with warning.
    """
    auth_header = request.headers.get("Authorization")
    
    if auth_header:
        try:
            scheme, token = auth_header.split()
            if scheme.lower() == 'bearer' and token == SERVER_TOKEN:
                return True
        except ValueError:
            pass
            
    # Check IP
    client_host = request.client.host
    if client_host in ["127.0.0.1", "::1", "localhost", "testclient"]:
        logger.warning(f"Unauthenticated access permitted from localhost ({client_host})")
        return True
        
    logger.warning(f"Unauthorized access blocked from {client_host}")
    raise HTTPException(status_code=401, detail="Authentication required")
