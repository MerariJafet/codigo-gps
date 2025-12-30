
from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from .routes import router_v1
from .schemas import GraphSchema, AnalyzeRequest

app = FastAPI(title="Codigo GPS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CODIGO_GPS_FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router_v1)

# Compatibilidad absoluta con frontend actual (legacy)
@app.post("/analyze", response_model=GraphSchema)
def analyze_compat(request: AnalyzeRequest):
    # Delegate by calling the router function directly? 
    # Better to just reuse the logic or redirect. 
    # We can import search the route handler but cleanest is just:
    from .routes import analyze
    return analyze(request)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/version")
def version():
    return {"version": "1.0.0"}

# /browse endpoint removed for security reasons (no server-side GUI triggering)
