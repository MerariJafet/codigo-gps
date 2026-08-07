"""Tests for the module detection and insight engines."""
import os
import sys
import textwrap

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.analyzer import analyze_repo
from backend.core.insights import scan_content, compute_health
from backend.core.modules import build_modules


@pytest.fixture()
def demo_repo(tmp_path):
    """Synthetic repo with modules, a cycle, a secret and a big file."""
    api = tmp_path / "api"
    web = tmp_path / "web"
    api.mkdir()
    web.mkdir()

    # Cycle: a.py <-> b.py
    (api / "a.py").write_text(textwrap.dedent("""
        from api.b import thing
        def a(): return thing()
    """))
    (api / "b.py").write_text(textwrap.dedent("""
        from api.a import a
        def thing(): return a
    """))
    # Secret + shell=True
    (api / "config.py").write_text(
        'API_KEY = "sk-abcdef1234567890XYZ"\n'
        'import subprocess\n'
        'subprocess.run("ls " + path, shell=True)\n'
    )
    # Giant file
    (web / "big.js").write_text("\n".join(f"// line {i}" for i in range(450)))
    # Normal frontend file importing nothing
    (web / "app.js").write_text("import './big'\nconst x = 1\n")
    return str(tmp_path)


def test_analyze_produces_modules_and_summary(demo_repo):
    graph = analyze_repo(demo_repo)
    assert graph.modules, "should detect modules"
    mod_ids = {m["id"] for m in graph.modules}
    assert "api" in mod_ids and "web" in mod_ids
    # every node got a module assignment
    assert all(n.module for n in graph.nodes)
    # summary basics
    assert graph.summary["total_files"] == len(graph.nodes)
    assert graph.summary["health"]["score"] <= 100
    assert graph.summary["languages"]


def test_cycle_detected_and_links_flagged(demo_repo):
    graph = analyze_repo(demo_repo)
    cycle_insights = [i for i in graph.insights if "circular" in i["title"].lower()]
    assert cycle_insights, "cycle a.py <-> b.py should be detected"
    flagged = [l for l in graph.links if "cycle" in l.flags]
    assert len(flagged) >= 2


def test_security_findings(demo_repo):
    graph = analyze_repo(demo_repo)
    titles = " | ".join(i["title"] for i in graph.insights)
    assert "secreto" in titles.lower()
    assert "shell=True" in titles
    # every insight carries teaching content
    for ins in graph.insights:
        assert ins["why_matters"] and ins["recommendation"]


def test_giant_file_detected(demo_repo):
    graph = analyze_repo(demo_repo)
    assert any("gigante" in i["title"].lower() for i in graph.insights)


def test_scan_content_ignores_env_lookups():
    findings = scan_content("x.py", 'PASSWORD = os.environ["DB_PASS"]\n')
    assert not [f for f in findings if f["rule"] == "hardcoded_secret"]


def test_scan_content_detects_secret():
    findings = scan_content("x.py", 'password = "supersecret123"\n')
    assert [f for f in findings if f["rule"] == "hardcoded_secret"]


def test_secret_evidence_is_redacted():
    findings = scan_content("x.py", 'API_KEY = "sk-live-abcdef1234567890"\n')
    secret = [f for f in findings if f["rule"] == "hardcoded_secret"][0]
    assert "sk-live-abcdef1234567890" not in secret["snippet"]
    assert "••••" in secret["snippet"]


def test_api_call_with_query_string_detected():
    from backend.core.analyzer import _extract_api_calls
    calls = _extract_api_calls("const r = await fetch('/api/v1/users?active=true&page=2')\n")
    assert "/users" in calls


def test_build_modules_stats():
    nodes = [
        {"id": "file:api/a.py", "label": "api/a.py",
         "metrics": {"loc": 10, "complexity": 2, "degree": 1},
         "folders": {"segments": ["api"]}},
        {"id": "file:api/b.py", "label": "api/b.py",
         "metrics": {"loc": 20, "complexity": 3, "degree": 1},
         "folders": {"segments": ["api"]}},
        {"id": "file:web/c.js", "label": "web/c.js",
         "metrics": {"loc": 30, "complexity": 1, "degree": 0},
         "folders": {"segments": ["web"]}},
    ]
    links = [{"source": "file:api/a.py", "target": "file:api/b.py"}]
    out = build_modules(nodes, links)
    api = next(m for m in out["modules"] if m["id"] == "api")
    assert api["file_count"] == 2
    assert api["internal_links"] == 1
    assert api["cohesion"] == 1.0
    assert api["main_language"] == "Python"


def test_health_score_penalties():
    healthy = compute_health([], 10)
    assert healthy["score"] == 100 and healthy["grade"] == "A"
    sick = compute_health([{"severity": "critical"}] * 4 + [{"severity": "high"}] * 3, 10)
    assert sick["score"] < 40
