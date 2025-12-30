from fastapi import APIRouter
from .health import router as health_router
from .analyze import router as analyze_router
from .graphs import router as graphs_router
from .open_graph import router as open_graph_router

router_v1 = APIRouter(prefix="/api/v1")

router_v1.include_router(health_router)
router_v1.include_router(analyze_router)
router_v1.include_router(graphs_router)
router_v1.include_router(open_graph_router)
from .system import router as system_router
router_v1.include_router(system_router)

# Legacy support hooks if needed
from .analyze import analyze as analyze_logic 
from .open_graph import open_graph as open_graph_logic
