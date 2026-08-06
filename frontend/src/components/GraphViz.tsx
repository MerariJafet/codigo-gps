import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import LegendPanel from './LegendPanel';
import { PerformanceMode } from './PerformancePanel';
import { getNodeColor, getNodeSize, getNodeGlow, getPhysicsConfig } from './GraphConfig';
import { NodeTooltip } from './NodeTooltip';

import { Node, Link, GraphData, Module, Insight } from '../types';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

const DANGER_COLOR = '#FF2E63';

interface GraphVizProps {
    data: GraphData | null;
    onNodeClick?: (node: Node) => void;
    performanceMode: PerformanceMode;
    onStatsUpdate?: (stats: { fps: number; nodeCount: number; linkCount: number }) => void;
    groupByModule: boolean;
    highlightInsight?: Insight | null;
    focusModule?: string | null;
}

const endId = (x: any): string => (typeof x === 'object' && x !== null ? x.id : x);

/** Distributes N module centers on a sphere using a golden spiral. */
function computeModuleCenters(modules: Module[], spacing: number): Map<string, { x: number; y: number; z: number }> {
    const centers = new Map<string, { x: number; y: number; z: number }>();
    const n = modules.length;
    if (n === 0) return centers;
    if (n === 1) {
        centers.set(modules[0].id, { x: 0, y: 0, z: 0 });
        return centers;
    }
    const R = spacing * (160 + 55 * Math.sqrt(n));
    const golden = Math.PI * (3 - Math.sqrt(5));
    modules.forEach((m, i) => {
        const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        centers.set(m.id, {
            x: Math.cos(theta) * rad * R,
            y: y * R * 0.7,
            z: Math.sin(theta) * rad * R,
        });
    });
    return centers;
}

/** Canvas-based text sprite for module labels floating over each region. */
function makeLabelSprite(text: string, subtext: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = 'center';

    ctx.font = 'bold 64px "Segoe UI", sans-serif';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, 320, 92);

    ctx.font = '38px "Segoe UI", sans-serif';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(subtext, 320, 152);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(160, 50, 1);
    sprite.renderOrder = 10;
    return sprite;
}

export default function GraphViz({ data, onNodeClick, performanceMode, onStatsUpdate, groupByModule, highlightInsight, focusModule }: GraphVizProps) {
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ w: 800, h: 600 });
    const frameRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(performance.now());
    const frameCountRef = useRef<number>(0);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [clusterSpacing] = useState(1.4);
    const [hoveredModule, setHoveredModule] = useState<string | null>(null);
    const [sceneReady, setSceneReady] = useState(false);
    const hasFittedRef = useRef(false);
    const centerForceRef = useRef<any>(null);
    useEffect(() => { hasFittedRef.current = false; }, [data]);

    // The 3D scene initializes asynchronously after ForceGraph3D mounts; poll
    // until it exists so scene-dependent effects (nebulas, physics) can run.
    useEffect(() => {
        if (!data?.nodes?.length) { setSceneReady(false); return; }
        if (fgRef.current?.scene?.()) { setSceneReady(true); return; }
        const timer = setInterval(() => {
            if (fgRef.current?.scene?.()) {
                setSceneReady(true);
                clearInterval(timer);
            }
        }, 150);
        return () => clearInterval(timer);
    }, [data]);

    const modules = data?.modules || [];
    const moduleColor = useMemo(() => {
        const m = new Map<string, string>();
        modules.forEach((mod) => m.set(mod.id, mod.color));
        return m;
    }, [modules]);

    const moduleCenters = useMemo(
        () => computeModuleCenters(modules, clusterSpacing),
        [modules, clusterSpacing]
    );


    // Seed initial node positions near their module center so the simulation
    // starts pre-clustered and regions stay coherent.
    useMemo(() => {
        if (!data?.nodes || moduleCenters.size === 0) return;
        data.nodes.forEach((n: any) => {
            if (n.__seeded) return;
            const c = moduleCenters.get(n.module);
            if (!c) return;
            const jitter = 55;
            n.x = c.x + (Math.random() - 0.5) * jitter * 2;
            n.y = c.y + (Math.random() - 0.5) * jitter * 2;
            n.z = c.z + (Math.random() - 0.5) * jitter * 2;
            n.__seeded = true;
        });
    }, [data, moduleCenters]);

    // Sets for insight highlighting (red lines / red nodes)
    const highlightNodeSet = useMemo(
        () => new Set(highlightInsight?.nodes || []),
        [highlightInsight]
    );
    const highlightLinkSet = useMemo(() => {
        const s = new Set<string>();
        (highlightInsight?.links || []).forEach((l) => s.add(`${l.source}|${l.target}`));
        return s;
    }, [highlightInsight]);

    useEffect(() => {
        if (!containerRef.current) return;
        // Measure synchronously: ResizeObserver's initial delivery can be
        // throttled on hidden tabs, leaving the canvas at the default size.
        const measure = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
                setDimensions({ w: rect.width, h: rect.height });
            }
        };
        measure();
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(containerRef.current);
        window.addEventListener('resize', measure);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', measure);
        };
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
                    linkCount: data?.links?.length || 0,
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
        return endId(link.source) === selectedNodeId || endId(link.target) === selectedNodeId;
    }, [selectedNodeId]);

    const resolveNodeColor = useCallback((node: any, isSelected: boolean) => {
        if (isSelected) return '#FF9800';
        if (highlightInsight) {
            return highlightNodeSet.has(node.id) ? DANGER_COLOR : '#2A3340';
        }
        if (groupByModule && node.module && moduleColor.has(node.module)) {
            return moduleColor.get(node.module)!;
        }
        return getNodeColor(node, false);
    }, [highlightInsight, highlightNodeSet, groupByModule, moduleColor]);

    const nodeObject = useCallback((node: any) => {
        const isSelected = selectedNodeId === node.id;
        const color = resolveNodeColor(node, isSelected);
        const size = getNodeSize(node);
        const glow = getNodeGlow(node);
        const isDanger = highlightInsight && highlightNodeSet.has(node.id);

        if (performanceMode === 'high-performance') {
            const geometry = new THREE.IcosahedronGeometry(size, 0);
            const material = new THREE.MeshBasicMaterial({ color });
            return new THREE.Mesh(geometry, material);
        }

        const group = new THREE.Group();
        const detail = performanceMode === 'balanced' ? 8 : 16;
        const geometry = new THREE.SphereGeometry(size, detail, detail);
        const material = new THREE.MeshLambertMaterial({
            color,
            transparent: true,
            opacity: highlightInsight && !isDanger && !isSelected ? 0.35 : 0.9,
            emissive: color,
            emissiveIntensity: isSelected || isDanger ? 0.9 : 0.5,
        });
        group.add(new THREE.Mesh(geometry, material));

        if (glow > 0 || isSelected || isDanger) {
            const haloGeo = new THREE.SphereGeometry(size * (isSelected || isDanger ? 1.5 : 1.2), detail, detail);
            const haloMat = new THREE.MeshBasicMaterial({
                color: isDanger ? DANGER_COLOR : isSelected ? '#FF9800' : (node.classification?.role === 'entrypoint' ? '#ffffff' : color),
                transparent: true,
                opacity: isSelected || isDanger ? 0.35 : 0.15 * glow,
                side: THREE.BackSide,
            });
            group.add(new THREE.Mesh(haloGeo, haloMat));
        }
        return group;
    }, [performanceMode, selectedNodeId, resolveNodeColor, highlightInsight, highlightNodeSet]);

    // Physics: cluster nodes around their module center
    useEffect(() => {
        const fg = fgRef.current;
        // The dynamic-imported ForceGraph exposes its imperative API asynchronously
        if (!fg || typeof fg.d3Force !== 'function') return;

        const config = getPhysicsConfig(performanceMode);
        const grouped = groupByModule && moduleCenters.size > 0;
        const d3Force = fg.d3Force('charge');
        // Softer repulsion in region mode so loose nodes don't escape their nebula
        if (d3Force) d3Force.strength(grouped ? -70 : config.chargeStrength);

        // The default 'center' force drags the whole graph toward the origin,
        // offsetting every cluster from its nebula. Disable it in region mode.
        if (!centerForceRef.current) centerForceRef.current = fg.d3Force('center') || null;
        fg.d3Force('center', grouped ? null : centerForceRef.current);

        // Cross-module links must not drag whole regions together: long distance
        // and near-zero strength for them; short and firm within a module.
        const linkForce = fg.d3Force('link');
        if (linkForce && linkForce.distance && linkForce.strength) {
            const sameModule = (l: any) =>
                (typeof l.source === 'object' ? l.source.module : null) ===
                (typeof l.target === 'object' ? l.target.module : null);
            if (grouped) {
                linkForce.distance((l: any) => (sameModule(l) ? 50 : 260));
                linkForce.strength((l: any) => (sameModule(l) ? 0.5 : 0.015));
            } else {
                linkForce.distance(45);
                linkForce.strength(0.3);
            }
        }

        if (grouped) {
            fg.d3Force('cluster', (alpha: number) => {
                // proportional to alpha, like the built-in forces, so the
                // pull/repulsion ratio stays constant while cooling
                const k = 0.22 * alpha;
                data?.nodes.forEach((node: any) => {
                    const center = moduleCenters.get(node.module);
                    if (!center) return;
                    node.vx += (center.x - node.x) * k;
                    node.vy += (center.y - node.y) * k;
                    node.vz += (center.z - node.z) * k;
                });
            });
        } else {
            fg.d3Force('cluster', null);
        }

        // alphaDecay/velocityDecay are component props (set on <ForceGraph3D>),
        // not imperative methods — only reheat here.
        if (typeof fg.d3ReheatSimulation === 'function') fg.d3ReheatSimulation();
    }, [performanceMode, groupByModule, data, moduleCenters, sceneReady]);

    // Nebulas + labels per module region
    const nebulaRef = useRef<THREE.Group | null>(null);
    useEffect(() => {
        const scene = fgRef.current?.scene();
        if (!scene) return;

        if (nebulaRef.current) {
            scene.remove(nebulaRef.current);
            nebulaRef.current.clear();
            nebulaRef.current = null;
        }
        if (!groupByModule || modules.length === 0) return;

        const nebulas = new THREE.Group();
        nebulas.renderOrder = -1;
        nebulaRef.current = nebulas;
        scene.add(nebulas);

        modules.forEach((mod) => {
            const center = moduleCenters.get(mod.id);
            if (!center) return;
            const isHovered = hoveredModule === mod.id || focusModule === mod.id;
            const radius = clusterSpacing * (38 + 15 * Math.sqrt(mod.file_count));

            const geo = new THREE.SphereGeometry(radius, 32, 32);
            const mat = new THREE.MeshLambertMaterial({
                color: mod.color,
                transparent: true,
                opacity: isHovered ? 0.55 : 0.22,
                depthWrite: false,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(center.x, center.y, center.z);
            mesh.renderOrder = -1;
            nebulas.add(mesh);

            const label = makeLabelSprite(mod.name.toUpperCase(), `${mod.file_count} archivos · ${mod.main_language}`, mod.color);
            label.position.set(center.x, center.y + radius + 22, center.z);
            label.scale.set(110, 34, 1);
            nebulas.add(label);
        });
    }, [groupByModule, clusterSpacing, modules, moduleCenters, hoveredModule, focusModule, data, sceneReady]);

    // Camera focus when a module is selected from other views
    useEffect(() => {
        if (!focusModule || !fgRef.current) return;
        const center = moduleCenters.get(focusModule);
        if (!center) return;
        const dist = 1.9;
        fgRef.current.cameraPosition(
            { x: center.x * dist + 200, y: center.y * dist + 120, z: center.z * dist + 200 },
            center,
            1500
        );
    }, [focusModule, moduleCenters]);

    const linkKey = (link: any) => `${endId(link.source)}|${endId(link.target)}`;
    const isDangerLink = useCallback((link: any) => {
        if (highlightInsight) return highlightLinkSet.has(linkKey(link));
        return (link.flags || []).includes('cycle');
    }, [highlightInsight, highlightLinkSet]);

    const getLinkWidth = (link: any) => {
        if (isDangerLink(link)) return 2.6;
        if (selectedNodeId) return isLinkRelatedToSelection(link) ? 2.2 : 0.5;
        return performanceMode === 'high-performance' ? 0.9 : 1.8;
    };

    const hexToRgba = (hex: string, alpha: number) => {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    };

    const getLinkColor = (link: any) => {
        if (isDangerLink(link)) return DANGER_COLOR;
        if (highlightInsight) return 'rgba(60, 70, 85, 0.12)';
        if (selectedNodeId) {
            if (isLinkRelatedToSelection(link)) return 'rgba(0, 255, 127, 1.0)';
            return 'rgba(68, 68, 68, 0.1)';
        }
        // Tint each link with its source module color so connections read
        // clearly inside a region; cross-module links stay white.
        const src: any = typeof link.source === 'object' ? link.source : null;
        const tgt: any = typeof link.target === 'object' ? link.target : null;
        if (groupByModule && src && tgt && src.module === tgt.module && moduleColor.has(src.module)) {
            return hexToRgba(moduleColor.get(src.module)!, 0.85);
        }
        return 'rgba(255, 255, 255, 0.55)';
    };

    const getParticleCount = (link: any) => {
        if (isDangerLink(link)) return 3;
        if (performanceMode === 'high-performance') return 0;
        return performanceMode === 'balanced' ? 1 : 2;
    };
    const getLinkResolution = () => (performanceMode === 'high-performance' ? 3 : 6);

    if (typeof window === 'undefined') return null;

    const activeNode = selectedNodeId
        ? data?.nodes.find((n) => n.id === selectedNodeId)
        : hoveredNode;

    const moduleStats = modules.map((m) => ({ path: m.name, count: m.file_count, color: m.color, id: m.id }));

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
                    nodeColor={(node: any) => resolveNodeColor(node, node.id === selectedNodeId)}
                    nodeRelSize={6}
                    d3AlphaDecay={groupByModule ? 0.028 : getPhysicsConfig(performanceMode).alphaDecay}
                    d3VelocityDecay={getPhysicsConfig(performanceMode).velocityDecay}
                    nodeThreeObject={nodeObject}
                    linkWidth={getLinkWidth}
                    linkResolution={getLinkResolution()}
                    linkDirectionalParticles={getParticleCount}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={(link: any) => (isDangerLink(link) ? DANGER_COLOR : '#37FFB0')}
                    linkDirectionalParticleSpeed={0.005}
                    backgroundColor="#00000000"
                    showNavInfo={false}
                    linkColor={getLinkColor}
                    onEngineStop={() => {
                        if (!hasFittedRef.current && fgRef.current?.zoomToFit) {
                            hasFittedRef.current = true;
                            fgRef.current.zoomToFit(1000, 70);
                        }
                    }}
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
                        powerPreference: 'high-performance',
                        antialias: performanceMode !== 'high-performance',
                        // @ts-ignore
                        preserveDrawingBuffer: false,
                    }}
                />
            )}

            <div
                className="absolute inset-0 pointer-events-none"
                onMouseMove={(e) => {
                    if (!selectedNodeId) setCursorPos({ x: e.clientX, y: e.clientY });
                }}
            />

            {highlightInsight && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="bg-[#FF2E63]/15 border border-[#FF2E63]/50 px-5 py-2 rounded-full backdrop-blur flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#FF2E63] animate-pulse" />
                        <span className="text-xs text-[#FF8FA9] tracking-wide">{highlightInsight.title}</span>
                    </div>
                </div>
            )}

            {moduleStats.length > 0 && groupByModule && (
                <LegendPanel folderStats={moduleStats} onFolderHover={(id: string | null) => setHoveredModule(id)} />
            )}
        </div>
    );
}
