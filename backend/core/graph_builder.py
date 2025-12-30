import networkx as nx
from .models import Graph, Node, Link, Metrics, Classification, FolderInfo

class GraphBuilder:
    """
    GraphBuilder constructs the network graph where:
    - NODE = A specific FILE in the repository (e.g., 'backend/main.py')
    - LINK = A dependency connection (e.g., 'backend/main.py' imports 'backend/core/graph.py')
    """
    def __init__(self):
        self.graph = nx.DiGraph()

    def add_file_node(self, file_path: str, repo_root: str, metrics: dict = None):
        """
        Creates a node representing a single file.
        """
        rel_path = file_path.replace(repo_root, "").strip("/")
        if not rel_path: # Handle root case if empty
             rel_path = file_path
             
        node_id = f"file:{rel_path}"
        
        node_metrics = {"loc": 0}
        if metrics:
            node_metrics.update(metrics)

        self.graph.add_node(node_id, type="file", label=rel_path, metrics=node_metrics)
        return node_id

    def update_node_metrics(self, node_id: str, metrics: dict):
        if self.graph.has_node(node_id):
            current = self.graph.nodes[node_id].get("metrics", {})
            current.update(metrics)
            self.graph.nodes[node_id]["metrics"] = current

    def add_dependency(self, source_id: str, target_id: str, relation: str):
        """
        Creates a directed edge representing a dependency (source -> target).
        """
        self.graph.add_edge(source_id, target_id, relation=relation)

    def build(self) -> Graph:
        # Calculate degrees before serialization
        in_degrees = dict(self.graph.in_degree())
        out_degrees = dict(self.graph.out_degree())
        degrees = dict(self.graph.degree())

        # Calculate role thresholds
        all_degrees = list(degrees.values())
        if all_degrees:
            all_degrees.sort(reverse=True)
            # Top 10% are core hubs, or degree >= 20
            top_10_percent = all_degrees[max(0, int(len(all_degrees) * 0.1) - 1)]
            hub_threshold = max(20, top_10_percent)
        else:
            hub_threshold = 20

        nodes = []
        for n, attrs in self.graph.nodes(data=True):
            base_metrics = attrs.get("metrics", {})
            degree = degrees.get(n, 0)
            
            # Merge graph-level metrics with node-level metrics
            # Note: base_metrics is a dict, we need to convert to Metrics object
            
            combined_metrics = Metrics(
                loc=base_metrics.get("loc", 0),
                complexity=base_metrics.get("complexity", 1),
                degree=degree,
                in_degree=in_degrees.get(n, 0),
                out_degree=out_degrees.get(n, 0)
            )
            
            # Classification Logic
            layer = self._classify_layer(n)
            role = self._classify_role(n, degree, hub_threshold, base_metrics)
            
            classification = Classification(
                layer=layer,
                role=role,
                flags=[]
            )
            
            folder_dict = self._extract_folder_info(n)
            folder_info = FolderInfo(**folder_dict)
            
            nodes.append(Node(
                id=n,
                type=attrs.get("type", "unknown"),
                label=attrs.get("label", n),
                path=attrs.get("label", n), # Using relative path as path for now
                metrics=combined_metrics,
                classification=classification,
                folders=folder_info
            ))
        
        links = []
        for u, v, attrs in self.graph.edges(data=True):
            links.append(Link(
                source=u,
                target=v,
                relation=attrs.get("relation", "depends_on")
            ))
            
        return Graph(nodes=nodes, links=links)

    def _classify_layer(self, file_path: str) -> str:
        """
        Heuristic to determine the architectural layer of a file.
        """
        # Remove 'file:' prefix for checking
        path = file_path.replace("file:", "").lower()
        
        if any(x in path for x in ['backend/', 'server/', 'api/', 'core/', 'models/', 'services/']) or path.endswith('.py'):
            if 'test' in path: return 'test'
            return 'backend'
            
        if any(x in path for x in ['frontend/', 'ui/', 'components/', 'pages/', 'public/', 'src/']) or path.endswith(('.tsx', '.jsx', '.ts', '.css', '.scss')):
            if 'test' in path or '.spec.' in path: return 'test'
            return 'frontend'
            
        if any(x in path for x in ['shared/', 'common/', 'utils/', 'lib/', 'types/']):
            return 'shared'
            
        if any(x in path for x in ['config/', 'infra/', 'docker', '.env', '.json', '.toml', '.yml', 'makefile']):
            return 'config'
            
        return 'unknown'

    def _classify_role(self, file_path: str, degree: int, hub_threshold: int, metrics: dict) -> str:
        """
        Heuristic to determine the role of a file in the graph.
        """
        path = file_path.replace("file:", "").lower()
        
        # Entrypoints
        if any(x in path for x in ['main.py', 'app.py', 'index.tsx', 'main.tsx', 'server.js', 'index.js']):
            return 'entrypoint'
            
        # Orphans
        if degree == 0:
            return 'orphan'
            
        # Core Hubs
        if degree >= hub_threshold:
            return 'core_hub'
            
        return 'leaf'

    def _extract_folder_info(self, file_id: str) -> dict:
        """
        Extracts folder structure from file path.
        Returns dict matching FolderInfo schema.
        """
        # file_id is like "file:backend/core/graph.py"
        path = file_id.replace("file:", "")
        
        # Split path
        parts = path.split('/')
        
        if len(parts) <= 1:
            # Root file (e.g. README.md)
            return {
                "full_path": path,
                "dir_path": "",
                "root_folder": "root",
                "segments": []
            }
            
        # Standard case
        filename = parts[-1]
        segments = parts[:-1]
        dir_path = "/".join(segments)
        root_folder = segments[0]
        
        return {
            "full_path": path,
            "dir_path": dir_path,
            "root_folder": root_folder,
            "segments": segments
        }
