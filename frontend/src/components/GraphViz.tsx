import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import LegendPanel from './LegendPanel';
import { PerformanceMode } from './PerformancePanel';
import { getNodeColor, getNodeSize, getNodeGlow, getPhysicsConfig, getFolderColor } from './GraphConfig';
import { NodeTooltip } from './NodeTooltip';

import { Node, Link, GraphData } from '../types';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface GraphVizProps {
    data: GraphData | null;
    onNodeClick?: (node: Node) => void;
    performanceMode: PerformanceMode;
    onStatsUpdate?: (stats: { fps: number; nodeCount: number; linkCount: number }) => void;
    groupByFolder: boolean;
}

export default function GraphViz({ data, onNodeClick, performanceMode, onStatsUpdate, groupByFolder }: GraphVizProps) {
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
    // ...
    const frameRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(performance.now());
    const frameCountRef = useRef<number>(0);

    // Interaction State
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

    const [clusterSpacing, setClusterSpacing] = useState(1.5);

    // Legend Interaction State
    const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ w: width, h: height });
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    // Stats Loop
    useEffect(() => {
        if (!onStatsUpdate) return;

        const loop = () => {
            const now = performance.now();
            frameCountRef.current++;

            if (now - lastTimeRef.current >= 1000) {
                const fps = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
                onStatsUpdate({
                    fps,
                    nodeCount: data?.nodes?.length || 0,
                    linkCount: data?.links?.length || 0
                });
                lastTimeRef.current = now;
                frameCountRef.current = 0;
            }
            frameRef.current = requestAnimationFrame(loop);
        };

        frameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameRef.current);
    }, [data, onStatsUpdate]);

    const isLinkRelatedToSelection = useCallback((link: any) => {
        if (!selectedNodeId) return false;
        return link.source.id === selectedNodeId || link.target.id === selectedNodeId;
    }, [selectedNodeId]);

    const folderStats = useMemo(() => {
        if (!data?.nodes) return [];
        const stats: { [key: string]: { count: number, color: string } } = {};

        data.nodes.forEach((node) => {
            const root = node.folders?.root_folder;
            if (root) {
                if (!stats[root]) {
                    // @ts-ignore
                    stats[root] = { count: 0, color: getFolderColor(root) };
                }
                stats[root].count++;
            }
        });

        return Object.entries(stats)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([path, info]) => ({
                path,
                count: info.count,
                color: info.color
            }));
    }, [data]);

    const nodeObject = useCallback((node: any) => {
        const isSelected = selectedNodeId === node.id;
        const color = getNodeColor(node, isSelected);
        const size = getNodeSize(node);
        const glow = getNodeGlow(node);

        if (performanceMode === 'high-performance') {
            const geometry = new THREE.IcosahedronGeometry(size, 0);
            const material = new THREE.MeshBasicMaterial({ color });
            return new THREE.Mesh(geometry, material);
        }

        if (performanceMode === 'balanced') {
            const geometry = new THREE.SphereGeometry(size, 8, 8);
            const material = new THREE.MeshLambertMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            return new THREE.Mesh(geometry, material);
        }

        const group = new THREE.Group();
        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshLambertMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            emissive: color,
            emissiveIntensity: isSelected ? 0.8 : 0.5
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        if (glow > 0 || isSelected) {
            const haloGeo = new THREE.SphereGeometry(size * (isSelected ? 1.4 : 1.2), 16, 16);
            const haloMat = new THREE.MeshBasicMaterial({
                color: isSelected ? '#FF9800' : (node.classification?.role === 'entrypoint' ? '#ffffff' : color),
                transparent: true,
                opacity: isSelected ? 0.3 : (0.15 * glow),
                side: THREE.BackSide
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            group.add(halo);
        }

        return group;
    }, [performanceMode, selectedNodeId]);

    const nebulaRef = useRef<THREE.Group | null>(null);

    useEffect(() => {
        if (!fgRef.current) return;

        const config = getPhysicsConfig(performanceMode);
        const d3Force = fgRef.current.d3Force('charge');
        if (d3Force) {
            d3Force.strength(config.chargeStrength);
        }

        if (groupByFolder) {
            fgRef.current.d3Force('cluster', (alpha: number) => {
                const k = 0.5 * alpha;
                const spacing = clusterSpacing;

                const rootCenters: { [key: string]: { x: number, y: number, z: number } } = {
                    'backend': { x: 300 * spacing, y: 0, z: 0 },
                    'frontend': { x: -300 * spacing, y: 0, z: 0 },
                    'core': { x: 0, y: 300 * spacing, z: 0 },
                    'shared': { x: 0, y: -300 * spacing, z: 0 },
                    'test': { x: 0, y: 0, z: 300 * spacing },
                    'config': { x: 0, y: 0, z: -300 * spacing }
                };

                data?.nodes.forEach((node: any) => {
                    const root = node.folders?.root_folder || 'unknown';
                    const center = rootCenters[root] || { x: 0, y: 500 * spacing, z: 0 };

                    node.vx += (center.x - node.x) * k * 0.1;
                    node.vy += (center.y - node.y) * k * 0.1;
                    node.vz += (center.z - node.z) * k * 0.1;
                });
            });
        } else {
            fgRef.current.d3Force('cluster', null);
        }

        fgRef.current.d3AlphaDecay(config.alphaDecay);
        fgRef.current.d3VelocityDecay(config.velocityDecay);
        fgRef.current.d3ReheatSimulation();

    }, [performanceMode, groupByFolder, data, clusterSpacing]);

    useEffect(() => {
        const scene = fgRef.current?.scene();
        if (!scene) return;

        if (nebulaRef.current) {
            scene.remove(nebulaRef.current);
            nebulaRef.current.clear();
            nebulaRef.current = null;
        }

        if (!groupByFolder || !data?.nodes?.length) return;

        const nebulas = new THREE.Group();
        nebulas.renderOrder = -1;
        nebulaRef.current = nebulas;
        scene.add(nebulas);

        const spacing = clusterSpacing;
        const rootCenters: { [key: string]: { x: number, y: number, z: number } } = {
            'backend': { x: 300 * spacing, y: 0, z: 0 },
            'frontend': { x: -300 * spacing, y: 0, z: 0 },
            'core': { x: 0, y: 300 * spacing, z: 0 },
            'shared': { x: 0, y: -300 * spacing, z: 0 },
            'test': { x: 0, y: 0, z: 300 * spacing },
            'config': { x: 0, y: 0, z: -300 * spacing }
        };

        Object.entries(rootCenters).forEach(([folder, center]) => {
            // @ts-ignore
            const color = getFolderColor(folder);
            const isHovered = hoveredFolder === folder;
            const size = 220 * spacing;

            const geo = new THREE.SphereGeometry(size, 48, 48);
            const mat = new THREE.MeshLambertMaterial({
                color: color,
                transparent: true,
                opacity: isHovered ? 0.6 : 0.32,
                depthWrite: false,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(center.x, center.y, center.z);
            mesh.renderOrder = -1;
            nebulas.add(mesh);
        });

    }, [groupByFolder, clusterSpacing, data, hoveredFolder]);

    const getLinkWidth = (link: any) => {
        if (selectedNodeId) {
            return isLinkRelatedToSelection(link) ? 2.0 : 0.5;
        }
        return performanceMode === 'high-performance' ? 0.2 : 0.5;
    };

    const getLinkColor = (link: any) => {
        if (selectedNodeId) {
            if (isLinkRelatedToSelection(link)) return "rgba(0, 255, 127, 1.0)";
            return "rgba(68, 68, 68, 0.1)";
        }
        const opacity = performanceMode === 'high-performance' ? 0.2 : 0.3;
        return `rgba(255, 255, 255, ${opacity})`;
    };

    const getParticleCount = () => {
        if (performanceMode === 'high-performance') return 0;
        if (performanceMode === 'balanced') return 1;
        return 2;
    };
    const getLinkResolution = () => performanceMode === 'high-performance' ? 3 : 6;

    if (typeof window === 'undefined') return null;

    const activeNode = selectedNodeId
        ? data?.nodes.find((n) => n.id === selectedNodeId)
        : hoveredNode;

    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden">
            <NodeTooltip
                // @ts-ignore
                node={activeNode}
                x={cursorPos.x}
                y={cursorPos.y}
                visible={!!activeNode}
            />

            {data && data.nodes.length > 0 && (
                <ForceGraph3D
                    ref={fgRef}
                    width={dimensions.w}
                    height={dimensions.h}
                    graphData={data}
                    nodeLabel=""
                    onNodeHover={(node: any) => setHoveredNode(node || null)}
                    onBackgroundClick={() => setSelectedNodeId(null)}
                    extraRenderers={[]}
                    nodeColor={(node: any) => getNodeColor(node, node.id === selectedNodeId)}
                    nodeRelSize={6}
                    nodeThreeObject={nodeObject}
                    linkWidth={getLinkWidth}
                    linkResolution={getLinkResolution()}
                    linkDirectionalParticles={getParticleCount()}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={() => '#37FFB0'}
                    linkDirectionalParticleSpeed={0.005}
                    backgroundColor="#00000000"
                    showNavInfo={false}
                    linkColor={getLinkColor}
                    onNodeClick={(node: any) => {
                        setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
                        const distance = 40;
                        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
                        fgRef.current.cameraPosition(
                            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                            node,
                            2000
                        );
                        if (onNodeClick) onNodeClick(node);
                    }}
                    rendererConfig={{
                        powerPreference: "high-performance",
                        antialias: performanceMode !== 'high-performance',
                        // @ts-ignore
                        preserveDrawingBuffer: false
                    }}
                />
            )}



            <div
                className="absolute inset-0 pointer-events-none"
                onMouseMove={(e) => {
                    if (!selectedNodeId) {
                        setCursorPos({ x: e.clientX, y: e.clientY });
                    }
                }}
            />

            {folderStats.length > 0 && (
                <LegendPanel folderStats={folderStats} onFolderHover={setHoveredFolder} />
            )}
        </div>
    );
}
