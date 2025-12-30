# Benchmarks & Performance 🚀

This document outlines the performance characteristics of **CÓDIGO GPS** and how to reproduce measurements.

## 📈 Methodology

We measure performance using the `scripts/benchmark_graph.py` utility, which tracks:
1.  **Analysis Time**: Time spent parsing files and extracting metadata.
2.  **Build Time**: Time spent constructing the `NetworkX` graph and calculating topological metrics.
3.  **Graph Size**: Total number of nodes (files) and edges (dependencies).

### Environment Specs (Reference)
*   **CPU**: [TBD - e.g. Intel Core i7 / Apple M2]
*   **RAM**: [TBD - e.g. 16GB]
*   **OS**: [TBD - e.g. Ubuntu 24.04 / macOS]

## 📊 Performance Results (TBD)

*Results will be populated as metrics are collected in different environments.*

| Project Size | Files (Nodes) | Deps (Edges) | Total Time |
| :--- | :--- | :--- | :--- |
| Tiny (backend/ core) | 28 | 35 | ~0.01s |
| Small (V0.1.0 Root) | 426 | 56 | ~0.58s |
| Medium (TBD) | TBD | TBD | TBD |
| Large (Monorepo) | TBD | TBD | TBD |

## 🕹️ How to Run Benchmarks

1.  Ensure you have the backend environment set up:
    ```bash
    cd backend
    source venv/bin/activate
    pip install -r requirements.txt
    ```

2.  Run the benchmark script against any folder:
    ```bash
    python scripts/benchmark_graph.py /path/to/target/repo
    ```

## 🛠️ Optimizations

*   **Caching**: Graphs can be exported to `grafo.json` to skip re-analysis.
*   **LOD (Level of Detail)**: The 3D renderer implements LOD to maintain >60 FPS on graphs with up to 2000 nodes.
*   **Parallel Analysis**: (Planned) Using `multiprocessing` for faster file parsing in large repos.
