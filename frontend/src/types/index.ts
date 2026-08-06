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
    module: string;

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
    flags?: string[]; // "cycle" | "tangle" | "cross_module"
}

export interface ModuleTopFile {
    id: string;
    label: string;
    loc: number;
    complexity: number;
}

export interface Module {
    id: string;
    name: string;
    color: string;
    file_count: number;
    total_loc: number;
    avg_complexity: number;
    internal_links: number;
    external_out: number;
    external_in: number;
    cohesion: number;
    main_language: string;
    top_files: ModuleTopFile[];
}

export interface ModuleLink {
    source: string;
    target: string;
    count: number;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface InsightEvidence {
    file: string;
    line: number;
    snippet: string;
}

export interface Insight {
    id: string;
    category: 'security' | 'architecture' | 'quality';
    severity: Severity;
    title: string;
    explanation: string;
    why_matters: string;
    recommendation: string;
    nodes: string[];
    links: { source: string; target: string }[];
    evidence: InsightEvidence[];
}

export interface HealthSummary {
    score: number;
    grade: string;
    verdict: string;
    severity_counts: Partial<Record<Severity, number>>;
}

export interface Summary {
    total_files: number;
    total_links: number;
    total_modules: number;
    total_loc: number;
    avg_complexity: number;
    health: HealthSummary;
    languages: { name: string; files: number; loc: number }[];
    complexity_buckets: { label: string; count: number }[];
    top_hubs: { id: string; label: string; degree: number; complexity: number; module: string }[];
    cycles_count: number;
}

export interface GraphData {
    nodes: Node[];
    links: Link[];
    modules?: Module[];
    module_links?: ModuleLink[];
    insights?: Insight[];
    summary?: Summary;
}

export const SEVERITY_COLORS: Record<Severity, string> = {
    critical: '#FF2E63',
    high: '#FF6B4A',
    medium: '#FFB74D',
    low: '#FFE066',
    info: '#7BA7C7',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Medio',
    low: 'Bajo',
    info: 'Info',
};

export const CATEGORY_LABELS: Record<string, string> = {
    security: 'Seguridad',
    architecture: 'Arquitectura',
    quality: 'Calidad',
};
