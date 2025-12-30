import time
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from backend.core.analyzer import analyze_repo
from backend.core.config import AnalysisOptions

def run_benchmark(target_path: str):
    print(f"=== Benchmarking CÓDIGO GPS Analysis ===")
    print(f"Target: {target_path}")
    
    if not os.path.exists(target_path):
        print(f"Error: Path {target_path} does not exist.")
        return

    # 1. Step: Complete Analysis process
    start_time = time.time()
    options = AnalysisOptions()
    graph = analyze_repo(target_path, options)
    total_duration = time.time() - start_time
    
    node_count = len(graph.nodes)
    edge_count = len(graph.links)
    
    print(f"\nResults:")
    print(f"- Nodes: {node_count}")
    print(f"- Edges: {edge_count}")
    print(f"- Total Parse & Build Time: {total_duration:.4f}s")
    print(f"- Throughput: {node_count / total_duration if total_duration > 0 else 0:.2f} nodes/sec")
    print(f"==========================================")

if __name__ == "__main__":
    # Default to analyzing the project itself
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    run_benchmark(target)
