import time
import asyncio
from fastapi import HTTPException, Request
from collections import defaultdict
from .logger import logger

# Configuration
RATE_LIMIT_REQUESTS = 10
RATE_LIMIT_WINDOW = 60 # seconds
MAX_CONCURRENT_ANALYSIS = 2

# State
request_history = defaultdict(list)
analysis_semaphore = asyncio.Semaphore(MAX_CONCURRENT_ANALYSIS)

async def rate_limit_dependency(request: Request):
    """
    Limits requests per IP address.
    """
    client_ip = request.client.host
    now = time.time()
    
    # Clean old history
    history = request_history[client_ip]
    valid_history = [t for t in history if now - t < RATE_LIMIT_WINDOW]
    request_history[client_ip] = valid_history
    
    if len(valid_history) >= RATE_LIMIT_REQUESTS:
        logger.warning(f"Rate limit exceeded for {client_ip}")
        raise HTTPException(status_code=429, detail="Too many requests")
        
    request_history[client_ip].append(now)
    return True

class ConcurrencyLimiter:
    """
    Context manager dependency for limiting concurrent operations.
    Usage: async with ConcurrencyLimiter(): ...
    """
    async def __call__(self):
        if analysis_semaphore.locked():
             logger.warning("Concurrency limit reached, waiting...")
        
        # We can't easily yield a context manager from a dependency to wrap the route logic 
        # without standard middleware or specific pattern.
        # Simple approach: Check availability and acquire? But need to release.
        # Best approach for FastAPI dependency: Return the semaphore and let route use 'async with'.
        return analysis_semaphore

async def get_concurrency_limiter():
    return analysis_semaphore
