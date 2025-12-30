export interface Metrics {
    loc: number;
    complexity: number;
    degree: number;
    in_degree: number;
    out_degree: number;
}

export interface FolderInfo {
    full_path: string;
    dir_path: string;
    root_folder: string;
    segments: string[];
}

export interface Classification {
    layer: string;
    role: string;
    flags: string[];
}

export interface Node {
    id: string;
    label: string;
    path: string;
    type: string;
    metrics: Metrics;
    classification: Classification;
    folders: FolderInfo;

    // Visualization properties (optional/runtime)
    x?: number;
    y?: number;
    z?: number;
    color?: string;
    val?: number; // size
}

export interface Link {
    source: string | Node; // ForceGraph can use objects
    target: string | Node;
    relation: string;
}

export interface GraphData {
    nodes: Node[];
    links: Link[];
}
