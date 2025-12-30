import pytest
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from backend.server.rate_limiter import rate_limit_dependency, request_history, RATE_LIMIT_REQUESTS
import time

app = FastAPI()

@app.get("/limited", dependencies=[Depends(rate_limit_dependency)])
def limited():
    return {"ok": True}

client = TestClient(app)

def test_rate_limit():
    # Clear history logic for test
    # Ideally rate_limiter would be a class we can reset, or accessing global
    request_history.clear()
    
    # Hit limit
    for i in range(RATE_LIMIT_REQUESTS):
        res = client.get("/limited")
        assert res.status_code == 200
        
    # Next should fail
    res = client.get("/limited")
    assert res.status_code == 429
