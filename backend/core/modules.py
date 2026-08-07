"""
Module (block) detection engine.

Groups files into logical modules ("regions") so the UI can render them as
visual territories. Strategy:
  1. Primary grouping by top-level folder.
  2. If a top-level folder dominates the repo (> DOMINANT_RATIO of files) and
     has subfolders, it is split one level deeper (e.g. "src" -> "src/components").
  3. Root-level files are grouped in a "root" module.

Also computes per-module statistics and aggregated module<->module links.
"""

from collections import defaultdict
from typing import Dict, List

DOMINANT_RATIO = 0.45
MIN_FILES_TO_SPLIT = 8

LANG_BY_EXT = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".css": "CSS",
    ".scss": "CSS",
    ".html": "HTML",
    ".md": "Markdown",
    ".json": "JSON",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".toml": "TOML",
    ".sh": "Shell",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".rb": "Ruby",
    ".php": "PHP",
}

# Neon palette used consistently by backend + frontend (index-based)
MODULE_PALETTE = [
    "#00E5FF",  # cyan
    "#FF4EC3",  # magenta
    "#B388FF",  # violet
    "#37FFB0",  # mint
    "#FFB74D",  # amber
    "#8BC34A",  # lime
    "#FF8A65",  # coral
    "#4FC3F7",  # sky
    "#F06292",  # pink
    "#AED581",  # green
    "#9575CD",  # purple
    "#FFD54F",  # yellow
]


def _file_ext(path: str) -> str:
    idx = path.rfind(".")
    return path[idx:].lower() if idx >= 0 else ""


def _detect_language(path: str) -> str:
    return LANG_BY_EXT.get(_file_ext(path), "Otro")


def assign_modules(nodes: List[dict]) -> Dict[str, str]:
    """
    nodes: list of dicts with keys id, folders(segments).
    Returns {node_id: module_id} where module_id is a folder-ish path like
    "backend" or "src/components", or "root" for top-level files.
    """
    total = len(nodes)
    by_root = defaultdict(list)
    for n in nodes:
        segments = n["folders"]["segments"]
        root = segments[0] if segments else "root"
        by_root[root].append(n)

    mapping: Dict[str, str] = {}
    for root, members in by_root.items():
        subdirs = {m["folders"]["segments"][1] for m in members if len(m["folders"]["segments"]) > 1}
        dominant = total > 0 and (len(members) / total) > DOMINANT_RATIO
        should_split = (
            root != "root"
            and dominant
            and len(subdirs) >= 2
            and len(members) >= MIN_FILES_TO_SPLIT
        )
        for m in members:
            segs = m["folders"]["segments"]
            if should_split and len(segs) > 1:
                mapping[m["id"]] = f"{root}/{segs[1]}"
            else:
                mapping[m["id"]] = root
    return mapping


def build_modules(nodes: List[dict], links: List[dict]) -> dict:
    """
    nodes: [{id, label, metrics{loc, complexity, degree}, folders{segments}}]
    links: [{source, target}]
    Returns {"modules": [...], "module_links": [...], "node_modules": {node_id: module_id}}
    """
    node_modules = assign_modules(nodes)
    node_by_id = {n["id"]: n for n in nodes}

    grouped = defaultdict(list)
    for node_id, mod in node_modules.items():
        grouped[mod].append(node_by_id[node_id])

    # Aggregate link counts
    internal = defaultdict(int)
    inter = defaultdict(int)  # (mod_a, mod_b) -> count (directed)
    for l in links:
        sm = node_modules.get(l["source"])
        tm = node_modules.get(l["target"])
        if sm is None or tm is None:
            continue
        if sm == tm:
            internal[sm] += 1
        else:
            inter[(sm, tm)] += 1

    modules = []
    sorted_mods = sorted(grouped.items(), key=lambda kv: -len(kv[1]))
    for idx, (mod_id, members) in enumerate(sorted_mods):
        total_loc = sum(m["metrics"].get("loc", 0) for m in members)
        complexities = [m["metrics"].get("complexity", 1) for m in members]
        avg_cx = round(sum(complexities) / len(complexities), 1) if complexities else 0

        ext_out = sum(c for (a, _b), c in inter.items() if a == mod_id)
        ext_in = sum(c for (_a, b), c in inter.items() if b == mod_id)
        internal_links = internal.get(mod_id, 0)
        boundary = internal_links + ext_out
        cohesion = round(internal_links / boundary, 2) if boundary > 0 else 1.0

        lang_count = defaultdict(int)
        for m in members:
            lang_count[_detect_language(m["label"])] += 1
        main_language = max(lang_count.items(), key=lambda kv: kv[1])[0] if lang_count else "Otro"

        top_files = sorted(
            members, key=lambda m: -(m["metrics"].get("complexity", 0) * 2 + m["metrics"].get("degree", 0))
        )[:5]

        modules.append({
            "id": mod_id,
            "name": mod_id if mod_id != "root" else "raíz del proyecto",
            "color": MODULE_PALETTE[idx % len(MODULE_PALETTE)],
            "file_count": len(members),
            "total_loc": total_loc,
            "avg_complexity": avg_cx,
            "internal_links": internal_links,
            "external_out": ext_out,
            "external_in": ext_in,
            "cohesion": cohesion,
            "main_language": main_language,
            "top_files": [{"id": m["id"], "label": m["label"],
                           "loc": m["metrics"].get("loc", 0),
                           "complexity": m["metrics"].get("complexity", 1)} for m in top_files],
        })

    module_links = [
        {"source": a, "target": b, "count": c}
        for (a, b), c in sorted(inter.items(), key=lambda kv: -kv[1])
    ]

    return {"modules": modules, "module_links": module_links, "node_modules": node_modules}
