# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-08-07

### Added
- **Module regions**: automatic logical-module detection rendered as labeled 3D "nebulas", with per-module cohesion/coupling metrics and module↔module links.
- **Insight engine (analyst + teacher)**: circular dependencies, god files, orphans, giant files, tangled modules, and static security scanning (hardcoded secrets, `eval`/`exec`, SQL injection patterns, `shell=True`, insecure pickle/yaml, weak hashes, XSS sinks, open CORS, debug flags) — every finding ships with *what / why it matters / how to fix* teaching content in Spanish.
- **HTTP bridges**: FastAPI route decorators matched against frontend `fetch`/`axios` URL literals, so frontend↔backend relationships appear even without imports (violet links).
- **Connection taxonomy**: red critical, violet HTTP bridge, amber module bridge, green essential (feeds a hub), module-tinted internal — with hover tooltips (`source → target · category`).
- **Four views**: Holograma, Dashboard (health A–F, language donut, complexity buckets, hubs), Módulos (cards + file-level bridge inspector), Maestro (teaching cards + red highlighting in the hologram).
- **Interactive modes**: Zoom (isolate a file and its 2-level connection chain), Move (drag a whole module by its nebula or any node), Learning tour (guided per-module walkthrough with camera flights).
- **AI-agent integration**: per-finding "Prompt para agente IA" button that copies a self-contained fix-and-verify prompt; new `AGENTS.md` with the machine-oriented repo map.
- **Server-side file browser** (`/api/v1/system/ls`): analyze any local folder by absolute path — no upload, no size limit (36 GB / 14,500-file repo analyzed in ~9 s).
- **Import resolver upgrades**: TS path aliases (`@/`, `~/`), Python relative imports with level, path-boundary matching (eliminates false cycles).
- Draggable + collapsible legend panel; `scripts/start.sh` one-command bootstrap; bilingual README (EN/ES).

### Fixed
- Frontend did not compile: `frontend/src/lib` (apiClient, tauri) was missing — hidden by a blanket `lib/` gitignore entry, now scoped to `/lib/`.
- Tailwind v4 was configured with v3 directives, so responsive variants never compiled.
- `d3AlphaDecay`/`d3VelocityDecay` were called as ref methods (they are props), which silently disabled all custom physics.
- Analyze route passed `options` positionally into the wrong parameter, ignoring user options.
- Removed dead `routes_legacy.py` (syntax error, unreferenced).
- Health score uses diminishing penalties; oversized finding lists are aggregated (big repos no longer flatten to 5/F with hundreds of duplicate insights).

## [0.1.1] - 2025-12-30

### Added
- **English Documentation**: Full README.md translation for global reach.
- **Project Badges**: Added License, Version, and CI status badges.
- **Architecture Deep-Dive**: Created `docs/ARCHITECTURE.md` with detailed Mermaid diagrams.
- **GitHub Actions CI**: Automated pipeline for frontend (lint/build) and backend (pytest).
- **Benchmark Methodology**: Added `docs/BENCHMARKS.md` and `scripts/benchmark_graph.py`.
- **Smoke Tests**: Added `backend/tests/test_smoke_import.py` for verification.

### Fixed
- **Mermaid Syntax**: Fixed diagram rendering in documentation.
- **Backend Dependencies**: Added `python-multipart` to `requirements.txt`.

### Changed
- Improved README structure with new "Performance & Limits" section.

## [0.1.0] - 2025-12-30

### Added
- Initial public release (MVP).
- 3D Hologram interactive visualization.
- FastAPI backend with NetworkX analysis.
- Next.js frontend with Three.js.
- Docker Compose support.
