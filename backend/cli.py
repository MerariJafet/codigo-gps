
import argparse
import sys
import uvicorn
import json
import os
from dataclasses import asdict
from backend.core import analyze_repo
from backend.core.config import AnalysisOptions

def main():
    parser = argparse.ArgumentParser(description="Código GPS CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze a repository and output JSON")
    analyze_parser.add_argument("--repo", required=True, help="Path to repository")
    analyze_parser.add_argument("--out", required=True, help="Output JSON file path")
    
    # API command
    api_parser = subparsers.add_parser("api", help="Start the API server")
    api_parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    api_parser.add_argument("--port", type=int, default=8000, help="Port to bind")
    
    # Daemon command
    daemon_parser = subparsers.add_parser("daemon", help="Run the API server in background mode")
    daemon_parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    daemon_parser.add_argument("--port", type=int, default=8000, help="Port to bind")

    args = parser.parse_args()

    if args.command == "analyze":
        print(f"Analyzing {args.repo}...")
        try:
            graph = analyze_repo(args.repo)
            
            # Convert dataclass to dict for JSON
            import dataclasses
            graph_dict = dataclasses.asdict(graph)
            
            with open(args.out, "w") as f:
                json.dump(graph_dict, f, indent=2)
                
            print(f"Analysis complete.")
            print(f"Nodes: {len(graph.nodes)}")
            print(f"Links: {len(graph.links)}")
            print(f"Output saved to {args.out}")
            
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)

    elif args.command == "api":
        print(f"Starting API on {args.host}:{args.port}...")
        uvicorn.run("backend.server.main:app", host=args.host, port=args.port, reload=True)

    elif args.command == "web":
        print("Starting web mode...")
        print(f"Open http://{args.host if 'host' in args else '127.0.0.1'}:8000/docs for API")
        # For now just run the API
        uvicorn.run("backend.server.main:app", host="127.0.0.1", port=8000, reload=True)

    elif args.command == "daemon":
        # In a real daemon we would double-fork or detach.
        # For this implementation we will run uvicorn and manage a PID file.
        pid_file = os.path.expanduser("~/.codigo_gps_daemon.pid")
        
        # Check if running
        if os.path.exists(pid_file):
            with open(pid_file, "r") as f:
                old_pid = f.read().strip()
                print(f"Daemon seems to be running (PID: {old_pid}).")
                print("If it is not running, delete ~/.codigo_gps_daemon.pid and try again.")
                # We could try to check if process exists, but keeping it simple.
                # If user persists, they can rm the file.
                return

        try:
            pid = os.getpid()
            with open(pid_file, "w") as f:
                f.write(str(pid))
            
            print(f"Daemon started. PID: {pid}. Use Ctrl+C to stop.")
            # Disable reload for production/daemon mode usually
            uvicorn.run("backend.server.main:app", host=args.host, port=args.port, reload=False)
        finally:
            if os.path.exists(pid_file):
                os.remove(pid_file)
        
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
