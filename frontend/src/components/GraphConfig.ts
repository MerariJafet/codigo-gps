export const GRAPH_COLORS = {
    backend: '#00E5FF',   // Cyan Neon
    frontend: '#FF4EC3',  // Magenta Neon
    shared: '#B388FF',    // Violet Neon
    config: '#FFB74D',    // Amber
    test: '#8BC34A',      // Lime Green
    unknown: '#B0BEC5',   // Blue Grey
    orphan: '#37474F',    // Dark Grey
    highlight: '#FFF176'  // Yellow
};

export const getNodeColor = (node: any, isSelected: boolean = false) => {
    if (isSelected) {
        return '#FF9800'; // Intense Orange for selection
    }

    const layer = node.classification?.layer || 'unknown';
    const role = node.classification?.role || 'leaf';

    if (role === 'orphan') return GRAPH_COLORS.orphan;
    // @ts-ignore
    return GRAPH_COLORS[layer] || GRAPH_COLORS.unknown;
};

export const getNodeSize = (node: any) => {
    const degree = node.metrics?.degree || 0;
    const role = node.classification?.role || 'leaf';
    const baseSize = 6;

    // Logarithmic scale for connections
    // Math.log2(1) = 0, Math.log2(2) = 1, Math.log2(32) = 5
    const scale = Math.log2(degree + 1);

    // Base multiplier: 0.8 + 0.2 * scale
    // 0 connections -> 0.8x
    // 1 connection (log2=1) -> 1.0x
    // 32 connections (log2=5) -> 1.8x
    let sizeMultiplier = 0.8 + (0.2 * scale);

    // Role-based enhancements (cumulative)
    if (role === 'entrypoint') sizeMultiplier *= 1.2;
    if (role === 'core_hub') sizeMultiplier *= 1.1;

    return baseSize * sizeMultiplier;
};

export const getNodeGlow = (node: any) => {
    const complexity = node.metrics?.complexity || 1;

    // Complexity-based glow intensity
    if (complexity <= 3) return 0.5;   // Low
    if (complexity <= 7) return 1.0;   // Medium
    return 1.6;                        // High
};

export const getPhysicsConfig = (mode: string) => {
    if (mode === 'high-performance') {
        return { chargeStrength: -30, alphaDecay: 0.1, velocityDecay: 0.8 };
    }
    return { chargeStrength: -120, alphaDecay: 0.01, velocityDecay: 0.6 };
};

export const getFolderColor = (folderPath: string): string => {
    if (!folderPath) return '#555555';

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < folderPath.length; i++) {
        hash = folderPath.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate HSL color - Brighter Neon Pastel
    // Hue: Consistent based on hash
    // Saturation: 85-95% (Vibrant Neon)
    // Lightness: 65-75% (Bright Pastel for visibility on dark bg)
    const h = Math.abs(hash % 360);
    const s = 90;
    const l = 70;

    return `hsl(${h}, ${s}%, ${l}%)`;
};
