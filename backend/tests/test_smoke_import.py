import pytest
from backend.server.main import app
from fastapi.testclient import TestClient

def test_import_analysis():
    """Verify that core analysis components can be imported."""
    try:
        from backend.core.analyzer import analyze_repo
        from backend.core.graph_builder import GraphBuilder
        from backend.core.config import AnalysisOptions
        assert True
    except ImportError as e:
        pytest.fail(f"Critical import failed: {e}")

def test_app_health_smoke():
    """Verify the FastAPI app initializes and responds to health check."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
