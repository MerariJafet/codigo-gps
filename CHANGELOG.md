# Changelog

All notable changes to this project will be documented in this file.

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
