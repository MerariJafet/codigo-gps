import os
from git import Repo
from typing import List

class GitIngestor:
    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.repo = None

    def load_repo(self):
        if not os.path.exists(self.repo_path):
            raise ValueError(f"Repository not found at {self.repo_path}")
        
        try:
            self.repo = Repo(self.repo_path)
            return True
        except Exception:
            # Not a git repo, but we can still analyze files
            self.repo = None
            return True

    def list_files(self) -> List[str]:
        files = []
        if self.repo:
            # Git mode
            try:
                for item in self.repo.tree().traverse():
                    if item.type == 'blob':
                        path = item.path
                        if any(x in path for x in ['node_modules/', 'venv/', '.git/', '__pycache__/', '.venv/']):
                           continue
                        if path.endswith(('.py', '.js', '.ts', '.java')):
                            files.append(os.path.join(self.repo_path, path))
                return files
            except:
                # Fallback if git traversal fails
                pass

        # Standard Walk Mode (Fallback)
        for root, dirs, filenames in os.walk(self.repo_path):
            # Ignore common folders
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'venv', '.git', '__pycache__', '.venv', 'dist', 'build']]
            
            for name in filenames:
                if name.endswith(('.py', '.js', '.ts', '.java')):
                    files.append(os.path.join(root, name))
        
        return files
