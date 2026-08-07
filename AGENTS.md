# AGENTS.md — CÓDIGO GPS

Machine-oriented guide for AI coding agents working on (or integrating with) this repository.

## What this project is

CÓDIGO GPS analyzes a local code repository and returns an enriched dependency graph (files, imports, HTTP bridges, logical modules, security/architecture/quality findings, health summary), rendered by a Next.js frontend as an interactive 3D hologram with teaching content in Spanish.

- **Backend**: Python 3.12, FastAPI, NetworkX. Entry: `backend/server/main.py` (app also re-exported by `backend/main.py`).
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, `react-force-graph-3d` (Three.js). Entry: `frontend/src/app/page.tsx`.
- UI language is Spanish; code identifiers and commit messages are English.

## Commands

```bash
# setup (from repo root)
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install

# run
.venv/bin/python -m uvicorn backend.server.main:app --port 8000   # backend
cd frontend && npm run dev                                         # frontend on :3000
./scripts/start.sh                                                 # both at once

# verify (all must pass before a PR)
.venv/bin/python -m pytest backend/tests -q      # 20+ tests
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```

CI (`.github/workflows/ci.yml`) runs pytest and lint+build on every PR to `main`.

## Architecture map

```
backend/
  core/
    analyzer.py       # pipeline orchestrator: scan → parse → resolve imports →
                      # HTTP bridges → build graph → enrich (modules, insights, summary)
    modules.py        # module/region detection, cohesion/coupling, module_links
    insights.py       # content rules (security regex) + graph detectors (cycles,
                      # god files, orphans, giants, tangles) + health score
    graph_builder.py  # NetworkX DiGraph → dataclasses (Node/Link/Graph)
    models.py         # dataclasses; Link.flags: cycle|tangle|cross_module|api
    config.py         # AnalysisOptions: ignore_patterns, extensions
  server/
    main.py           # FastAPI app + CORS
    routes/           # analyze.py, graphs.py, system.py (ls), open_graph.py, health.py
    auth.py           # bearer token w/ localhost-permissive mode
    rate_limiter.py   # 10 req/min/IP + concurrency semaphore (2)
  tests/              # pytest; test_insights_modules.py covers the v2 engines
frontend/src/
  app/page.tsx        # state hub: views, modes, insight highlight, module focus
  app/api/            # Next proxy routes → backend (health, analyze, graphs, system/ls)
  components/
    GraphViz.tsx      # 3D graph: regions/nebulas, link taxonomy, zoom mode,
                      # module dragging (nodes + nebula raycast), physics
    DashboardView.tsx / ModulesView.tsx / MentorView.tsx / TourGuide.tsx
    LegendPanel.tsx   # draggable/collapsible legend
    FileExplorerModal.tsx  # dual-mode picker: server-side browsing (absolute
                           # paths, no upload) + optional browser-upload
                           # manifest (filtered/capped) for Docker/remote
    charts/           # dependency-free SVG BarChart + Donut
  lib/apiClient.ts    # fetch wrapper via Next proxies
  types/index.ts      # Graph/Module/Insight/Summary types + severity color maps
```

## Graph response shape

`POST /api/v1/analyze` with `{"repo_path": "/abs/path"}` returns:

```jsonc
{
  "nodes":   [{ "id": "file:rel/path.py", "label": "rel/path.py", "module": "backend",
                "metrics": { "loc", "complexity", "degree", "in_degree", "out_degree" },
                "classification": { "layer", "role" }, "folders": {...} }],
  "links":   [{ "source", "target", "relation": "imports|api_call",
                "flags": ["cycle"|"tangle"|"cross_module"|"api"] }],
  "modules": [{ "id", "name", "color", "file_count", "total_loc", "avg_complexity",
                "internal_links", "external_out", "external_in", "cohesion",
                "main_language", "top_files": [...] }],
  "module_links": [{ "source", "target", "count" }],
  "insights": [{ "id", "category": "security|architecture|quality",
                 "severity": "critical|high|medium|low|info",
                 "title", "explanation", "why_matters", "recommendation",
                 "nodes": ["file:..."], "links": [...],
                 "evidence": [{ "file", "line", "snippet" }] }],
  "summary": { "total_files", "total_links", "total_modules", "total_loc",
               "avg_complexity", "health": { "score", "grade", "verdict",
               "severity_counts" }, "languages", "complexity_buckets",
               "top_hubs", "cycles_count" }
}
```

Auth: requests from localhost need no token (`get_current_user_permissive`); remote callers need `Authorization: Bearer <token>` from `~/.codigo_gps/config.json`.

## Known gotchas (learned the hard way — do not rediscover)

1. **react-force-graph**: `d3AlphaDecay` / `d3VelocityDecay` are component **props**, not imperative methods on the ref. Only `d3Force()`, `d3ReheatSimulation()`, `zoomToFit()`, `cameraPosition()`, `scene()`, `camera()`, `controls()` are ref methods.
2. **Tailwind v4**: `globals.css` must use `@import "tailwindcss"`. With the v3 `@tailwind` directives, responsive variants (`lg:` etc.) silently never compile.
3. **Custom d3 forces** must scale with `alpha` (no floor) or clusters collapse to a point as the sim cools. The default `center` force must be disabled in region mode or it drags every cluster toward the origin. Cross-module link force is weakened (`strength 0.015`) so bridges don't merge regions.
4. **Python import resolver** matches on path-segment boundaries (`/mod.py`), otherwise `test_insights_modules.py` matches `modules.py` and creates false cycles.
5. **.gitignore**: the Python-template `lib/` entry is scoped to `/lib/` — a blanket `lib/` silently excludes `frontend/src/lib/` from the repo.
6. **Scene timing**: the 3D scene initializes async after mount; effects that touch `fgRef.current.scene()` must poll/gate on scene readiness (`sceneReady` state in GraphViz).
7. **Nebulas** are plain THREE meshes outside the library's interaction system; dragging them uses a custom raycast (capture-phase pointerdown) with OrbitControls disabled during the gesture.
8. The backend does **not** hot-reload under `scripts/start.sh` or the preview config — restart it after changing Python code.

## Conventions

- Backend findings/teaching strings are Spanish; keep the three-block structure (`explanation` / `why_matters` / `recommendation`) for any new insight rule.
- New content rules go in `_CONTENT_RULES` (`backend/core/insights.py`) with `key`, `pattern`, optional `exclude`, `severity`, `category` and the three teaching strings.
- Aggregate per-file findings when a rule can fire hundreds of times on big repos (see giant/god file handling) — never emit unbounded insight lists.
- Frontend uses no chart libraries: extend `components/charts/` with plain SVG.
- Add pytest coverage for any backend behavior change (`backend/tests/`).
