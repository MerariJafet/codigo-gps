import React from 'react';
import { getFolderColor } from './GraphConfig';

interface NodeTooltipProps {
    node: any;
    x: number;
    y: number;
    visible: boolean;
}

const getComplexityLabel = (c: number) => {
    if (c <= 3) return { text: "Baja", color: "#4CAF50" }; // Green
    if (c <= 7) return { text: "Media", color: "#FFC107" }; // Amber
    return { text: "Alta", color: "#F44336" }; // Red
};

export const NodeTooltip: React.FC<NodeTooltipProps> = ({ node, x, y, visible }) => {
    if (!visible || !node) return null;

    const { metrics, classification } = node;
    const complexity = metrics?.complexity || 1;
    const complexityInfo = getComplexityLabel(complexity);

    return (
        <div
            style={{
                position: 'absolute',
                left: x + 15, // Offset
                top: y + 15,
                backgroundColor: 'rgba(10, 10, 10, 0.85)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                color: '#E0E0E0',
                pointerEvents: 'none',
                zIndex: 1000,
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                fontSize: '13px',
                fontFamily: 'monospace',
                minWidth: '220px',
            }}
        >
            <div style={{ fontWeight: 'bold', color: '#FFF', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                {node.label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
                <span style={{ color: '#888' }}>Layer:</span>
                <span style={{ color: '#FFF' }}>{classification?.layer || 'Unknown'}</span>

                <span style={{ color: '#888' }}>Folder:</span>
                <span style={{ color: getFolderColor(node.folders?.dir_path), fontWeight: 'bold' }}>
                    {node.folders?.dir_path || node.folders?.root_folder || 'root'}
                </span>

                <span style={{ color: '#888' }}>Role:</span>
                <span style={{ color: '#FFF' }}>{classification?.role || 'Leaf'}</span>

                <span style={{ color: '#888' }}>LOC:</span>
                <span style={{ color: '#FFF' }}>{metrics?.loc || 0}</span>

                <span style={{ color: '#888' }}>Complex:</span>
                <span style={{ color: complexityInfo.color, fontWeight: 'bold' }}>
                    {complexity} ({complexityInfo.text})
                </span>

                <span style={{ color: '#888' }}>Conn:</span>
                <span style={{ color: '#FFF' }}>
                    {/* Show total, or separated if available */}
                    {metrics?.degree || ((metrics?.in_degree || 0) + (metrics?.out_degree || 0))}
                    {metrics?.in_degree !== undefined && (
                        <span style={{ fontSize: '0.85em', color: '#AAA', marginLeft: '4px' }}>
                            (In: {metrics.in_degree}, Out: {metrics.out_degree})
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
};
