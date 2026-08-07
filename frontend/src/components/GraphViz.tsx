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
    zoomMode?: boolean;
    moveModuleMode?: boolean;
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

export default function GraphViz({ data, onNodeClick, performanceMode, onStatsUpdate, groupByModule, highlightInsight, focusModule, zoomMode = false, moveModuleMode = false }: GraphVizProps) {
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

    // User-dragged displacement per module (Modo Mover): effective center =
    // computed center + accumulated offset.
    const moduleOffsetsRef = useRef(new Map<string, { x: number; y: number; z: number }>());
    const [offsetsVersion, setOffsetsVersion] = useState(0);

    const effectiveCenters = useMemo(() => {
        const m = new Map<string, { x: number; y: number; z: number }>();
        moduleCenters.forEach((c, id) => {
            const o = moduleOffsetsRef.current.get(id) || { x: 0, y: 0, z: 0 };
            m.set(id, { x: c.x + o.x, y: c.y + o.y, z: c.z + o.z });
        });
        return m;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduleCenters, offsetsVersion]);

    // Ref so the d3 cluster force always reads fresh centers without re-registering
    const centersRef = useRef(effectiveCenters);
    useEffect(() => { centersRef.current = effectiveCenters; }, [effectiveCenters]);

    // New analysis: forget previous drags
    useEffect(() => {
        moduleOffsetsRef.current.clear();
        setOffsetsVersion(v => v + 1);
    }, [data]);


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

    // --- Zoom mode: focus on one node + its connection chain (depth 2) ------
    const [focusRoot, setFocusRoot] = useState<Node | null>(null);
    const [focusSet, setFocusSet] = useState<Set<string> | null>(null);

    const adjacency = useMemo(() => {
        const adj = new Map<string, string[]>();
        data?.links?.forEach((l) => {
            const s = endId(l.source), t = endId(l.target);
            if (!adj.has(s)) adj.set(s, []);
            if (!adj.has(t)) adj.set(t, []);
            adj.get(s)!.push(t);
            adj.get(t)!.push(s);
        });
        return adj;
    }, [data]);

    const focusOnNode = useCallback((node: any) => {
        const set = new Set<string>([node.id]);
        let frontier = [node.id];
        for (let depth = 0; depth < 2; depth++) {
            const next: string[] = [];
            frontier.forEach((id) => {
                (adjacency.get(id) || []).forEach((nb) => {
                    if (!set.has(nb)) { set.add(nb); next.push(nb); }
                });
            });
            frontier = next;
        }
        setFocusRoot(node);
        setFocusSet(set);
    }, [adjacency]);

    const clearFocus = useCallback(() => {
        setFocusRoot(null);
        setFocusSet(null);
    }, []);

    // Leaving zoom mode or loading new data clears the focus
    useEffect(() => { if (!zoomMode) clearFocus(); }, [zoomMode, clearFocus]);
    useEffect(() => { clearFocus(); }, [data, clearFocus]);

    const isNodeVisible = useCallback((node: any) => {
        if (!focusSet) return true;
        return focusSet.has(node.id);
    }, [focusSet]);

    const isLinkVisible = useCallback((link: any) => {
        if (!focusSet) return true;
        return focusSet.has(endId(link.source)) && focusSet.has(endId(link.target));
    }, [focusSet]);

    // Files that many others depend on: links flowing INTO them are "essential"
    const hubSet = useMemo(() => {
        const s = new Set<string>();
        data?.nodes?.forEach((n) => {
            if ((n.metrics?.in_degree || 0) >= 4 || n.classification?.role === 'core_hub') s.add(n.id);
        });
        return s;
    }, [data]);

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
        const isOrphan = node.classification?.role === 'orphan';
        const geometry = new THREE.SphereGeometry(size, detail, detail);
        const material = new THREE.MeshLambertMaterial({
            color,
            transparent: true,
            opacity: highlightInsight && !isDanger && !isSelected ? 0.35 : (isOrphan ? 0.4 : 0.9),
            emissive: color,
            emissiveIntensity: isSelected || isDanger ? 0.9 : (isOrphan ? 0.15 : 0.5),
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
                    const center = centersRef.current.get(node.module);
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

    // Nebulas + labels per module region (refs kept for live drag updates)
    const nebulaRef = useRef<THREE.Group | null>(null);
    const nebulaMeshesRef = useRef(new Map<string, { mesh: THREE.Mesh; label: THREE.Sprite; radius: number }>());
    useEffect(() => {
        const scene = fgRef.current?.scene();
        if (!scene) return;

        if (nebulaRef.current) {
            scene.remove(nebulaRef.current);
            nebulaRef.current.clear();
            nebulaRef.current = null;
        }
        nebulaMeshesRef.current.clear();
        if (!groupByModule || modules.length === 0 || focusSet) return;

        const nebulas = new THREE.Group();
        nebulas.renderOrder = -1;
        nebulaRef.current = nebulas;
        scene.add(nebulas);

        modules.forEach((mod) => {
            const center = effectiveCenters.get(mod.id);
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

            nebulaMeshesRef.current.set(mod.id, { mesh, label, radius });
        });
    }, [groupByModule, clusterSpacing, modules, effectiveCenters, hoveredModule, focusModule, data, sceneReady, focusSet]);

    // --- Modo Mover: dragging any node displaces its whole module ----------
    const dragSessionRef = useRef<{
        nodeId: string;
        module: string;
        starts: Map<string, { x: number; y: number; z: number }>;
        startOffset: { x: number; y: number; z: number };
    } | null>(null);

    const handleNodeDrag = useCallback((node: any, t: { x: number; y: number; z?: number }) => {
        if (!moveModuleMode || !node.module || !t) return;
        const translate = { x: t.x, y: t.y, z: t.z ?? 0 };
        let s = dragSessionRef.current;
        if (!s || s.nodeId !== node.id) {
            const starts = new Map<string, { x: number; y: number; z: number }>();
            data?.nodes.forEach((n: any) => {
                if (n.module === node.module) starts.set(n.id, { x: n.x, y: n.y, z: n.z });
            });
            s = {
                nodeId: node.id,
                module: node.module,
                starts,
                startOffset: { ...(moduleOffsetsRef.current.get(node.module) || { x: 0, y: 0, z: 0 }) },
            };
            dragSessionRef.current = s;
        }
        // Pin every sibling at its start position + the drag translation
        data?.nodes.forEach((n: any) => {
            if (n.module !== s!.module || n.id === node.id) return;
            const st = s!.starts.get(n.id);
            if (!st) return;
            n.fx = st.x + translate.x;
            n.fy = st.y + translate.y;
            n.fz = st.z + translate.z;
        });
        // Move the nebula + label live
        const parts = nebulaMeshesRef.current.get(s.module);
        const base = moduleCenters.get(s.module);
        if (parts && base) {
            const cx = base.x + s.startOffset.x + translate.x;
            const cy = base.y + s.startOffset.y + translate.y;
            const cz = base.z + s.startOffset.z + translate.z;
            parts.mesh.position.set(cx, cy, cz);
            parts.label.position.set(cx, cy + parts.radius + 22, cz);
        }
    }, [moveModuleMode, data, moduleCenters]);

    // Dragging the big nebula sphere (or its label) moves the whole module.
    // Custom raycast + camera-facing drag plane, since nebulas are scene
    // decorations outside the library's node-drag system.
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !moveModuleMode) return;

        const raycaster = new THREE.Raycaster();
        let session: {
            module: string;
            plane: THREE.Plane;
            startPoint: THREE.Vector3;
            starts: Map<string, { x: number; y: number; z: number }>;
            startOffset: { x: number; y: number; z: number };
        } | null = null;

        const ndcFromEvent = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            return new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
        };

        const nebulaModuleOf = (obj: THREE.Object3D): string | null => {
            for (const [modId, parts] of nebulaMeshesRef.current.entries()) {
                if (obj === parts.mesh || obj === parts.label) return modId;
            }
            return null;
        };

        const isNodeObject = (obj: THREE.Object3D): boolean => {
            let o: any = obj;
            while (o) {
                if (o.__graphObjType === 'node') return true;
                o = o.parent;
            }
            return false;
        };

        const applyTranslate = (t: THREE.Vector3) => {
            if (!session) return;
            data?.nodes.forEach((n: any) => {
                if (n.module !== session!.module) return;
                const st = session!.starts.get(n.id);
                if (!st) return;
                n.fx = st.x + t.x;
                n.fy = st.y + t.y;
                n.fz = st.z + t.z;
            });
            const parts = nebulaMeshesRef.current.get(session.module);
            const base = moduleCenters.get(session.module);
            if (parts && base) {
                const cx = base.x + session.startOffset.x + t.x;
                const cy = base.y + session.startOffset.y + t.y;
                const cz = base.z + session.startOffset.z + t.z;
                parts.mesh.position.set(cx, cy, cz);
                parts.label.position.set(cx, cy + parts.radius + 22, cz);
            }
        };

        const onDown = (e: PointerEvent) => {
            const fg = fgRef.current;
            if (!fg?.camera || !fg?.scene || e.button !== 0) return;
            const camera = fg.camera();
            raycaster.setFromCamera(ndcFromEvent(e), camera);
            const hits = raycaster.intersectObjects(fg.scene().children, true);
            for (const h of hits) {
                if (isNodeObject(h.object)) return; // node wins: library handles it
                const modId = nebulaModuleOf(h.object);
                if (!modId) continue;
                // Start module drag on a plane facing the camera through the hit
                const normal = new THREE.Vector3();
                camera.getWorldDirection(normal);
                const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, h.point.clone());
                const starts = new Map<string, { x: number; y: number; z: number }>();
                data?.nodes.forEach((n: any) => {
                    if (n.module === modId) starts.set(n.id, { x: n.x, y: n.y, z: n.z });
                });
                session = {
                    module: modId,
                    plane,
                    startPoint: h.point.clone(),
                    starts,
                    startOffset: { ...(moduleOffsetsRef.current.get(modId) || { x: 0, y: 0, z: 0 }) },
                };
                const controls = fg.controls?.();
                if (controls) controls.enabled = false;
                e.stopPropagation();
                e.preventDefault();
                return;
            }
        };

        const onMove = (e: PointerEvent) => {
            if (!session) return;
            const fg = fgRef.current;
            if (!fg?.camera) return;
            raycaster.setFromCamera(ndcFromEvent(e), fg.camera());
            const point = new THREE.Vector3();
            if (!raycaster.ray.intersectPlane(session.plane, point)) return;
            applyTranslate(point.clone().sub(session.startPoint));
        };

        const onUp = (e: PointerEvent) => {
            if (!session) return;
            const fg = fgRef.current;
            const point = new THREE.Vector3();
            let t = new THREE.Vector3();
            if (fg?.camera) {
                raycaster.setFromCamera(ndcFromEvent(e), fg.camera());
                if (raycaster.ray.intersectPlane(session.plane, point)) {
                    t = point.clone().sub(session.startPoint);
                }
            }
            moduleOffsetsRef.current.set(session.module, {
                x: session.startOffset.x + t.x,
                y: session.startOffset.y + t.y,
                z: session.startOffset.z + t.z,
            });
            const modId = session.module;
            data?.nodes.forEach((n: any) => {
                if (n.module === modId) { n.fx = undefined; n.fy = undefined; n.fz = undefined; }
            });
            const controls = fg?.controls?.();
            if (controls) controls.enabled = true;
            session = null;
            setOffsetsVersion(v => v + 1);
            fg?.d3ReheatSimulation?.();
        };

        container.addEventListener('pointerdown', onDown, true);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            container.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            const controls = fgRef.current?.controls?.();
            if (controls) controls.enabled = true;
        };
    }, [moveModuleMode, data, moduleCenters]);

    const handleNodeDragEnd = useCallback((node: any, translate?: { x: number; y: number; z?: number }) => {
        const s = dragSessionRef.current;
        if (!moveModuleMode || !s || s.nodeId !== node.id) return;
        const st = s.starts.get(node.id);
        const t = translate
            ? { x: translate.x, y: translate.y, z: translate.z ?? 0 }
            : (st ? { x: node.x - st.x, y: node.y - st.y, z: node.z - st.z } : { x: 0, y: 0, z: 0 });
        moduleOffsetsRef.current.set(s.module, {
            x: s.startOffset.x + t.x,
            y: s.startOffset.y + t.y,
            z: s.startOffset.z + t.z,
        });
        // Release pins so physics re-settles around the new center
        data?.nodes.forEach((n: any) => {
            if (n.module === s.module) { n.fx = undefined; n.fy = undefined; n.fz = undefined; }
        });
        dragSessionRef.current = null;
        setOffsetsVersion(v => v + 1);
        fgRef.current?.d3ReheatSimulation?.();
    }, [moveModuleMode, data]);

    // Camera focus when a module is selected from other views
    useEffect(() => {
        if (!focusModule || !fgRef.current) return;
        const center = effectiveCenters.get(focusModule);
        if (!center) return;
        const dist = 1.9;
        fgRef.current.cameraPosition(
            { x: center.x * dist + 200, y: center.y * dist + 120, z: center.z * dist + 200 },
            center,
            1500
        );
    }, [focusModule, effectiveCenters]);

    const linkKey = (link: any) => `${endId(link.source)}|${endId(link.target)}`;
    const isDangerLink = useCallback((link: any) => {
        if (highlightInsight) return highlightLinkSet.has(linkKey(link));
        return (link.flags || []).includes('cycle') || (link.flags || []).includes('tangle');
    }, [highlightInsight, highlightLinkSet]);

    // Link taxonomy:
    //   danger    (red)    — cycle/tangle or part of the highlighted finding
    //   api       (violet) — HTTP call from frontend code to a backend route
    //   bridge    (amber)  — crosses module boundaries (referential)
    //   essential (green)  — feeds a hub file many others depend on
    //   internal  (module) — normal import inside its module
    type LinkCategory = 'danger' | 'api' | 'bridge' | 'essential' | 'internal';
    const linkCategory = useCallback((link: any): LinkCategory => {
        if (isDangerLink(link)) return 'danger';
        if ((link.flags || []).includes('api')) return 'api';
        if ((link.flags || []).includes('cross_module')) return 'bridge';
        if (hubSet.has(endId(link.target))) return 'essential';
        return 'internal';
    }, [isDangerLink, hubSet]);

    const CATEGORY_NAMES: Record<LinkCategory, string> = {
        danger: 'CRÍTICA — ciclo o hallazgo',
        api: 'PUENTE HTTP — llamada a la API',
        bridge: 'PUENTE entre módulos',
        essential: 'ESENCIAL — alimenta un hub',
        internal: 'interna del módulo',
    };
    const BRIDGE_COLOR = '#FFD54F';
    const ESSENTIAL_COLOR = '#37FFB0';
    const API_COLOR = '#B388FF';

    const hexToRgba = (hex: string, alpha: number) => {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    };

    const getLinkWidth = (link: any) => {
        const cat = linkCategory(link);
        if (cat === 'danger') return 2.8;
        if (selectedNodeId) return isLinkRelatedToSelection(link) ? 2.4 : 0.5;
        if (highlightInsight) return 0.5;
        if (cat === 'api') return 2.2;
        if (cat === 'bridge') return 2.4;
        if (cat === 'essential') return 2.0;
        return performanceMode === 'high-performance' ? 0.9 : 1.6;
    };

    const getLinkColor = (link: any) => {
        const cat = linkCategory(link);
        if (cat === 'danger') return DANGER_COLOR;
        if (highlightInsight) return 'rgba(60, 70, 85, 0.12)';
        if (selectedNodeId) {
            if (isLinkRelatedToSelection(link)) return 'rgba(0, 255, 127, 1.0)';
            return 'rgba(68, 68, 68, 0.1)';
        }
        if (cat === 'api') return hexToRgba(API_COLOR, 0.9);
        if (cat === 'bridge') return hexToRgba(BRIDGE_COLOR, 0.9);
        if (cat === 'essential') return hexToRgba(ESSENTIAL_COLOR, 0.85);
        const src: any = typeof link.source === 'object' ? link.source : null;
        if (groupByModule && src && moduleColor.has(src.module)) {
            return hexToRgba(moduleColor.get(src.module)!, 0.8);
        }
        return 'rgba(255, 255, 255, 0.55)';
    };

    const getParticleCount = (link: any) => {
        const cat = linkCategory(link);
        if (cat === 'danger') return 3;
        if (cat === 'api') return 2;
        if (cat === 'bridge') return 2;
        if (cat === 'essential') return 3;
        if (performanceMode === 'high-performance') return 0;
        return performanceMode === 'balanced' ? 1 : 2;
    };
    const getParticleColor = (link: any) => {
        const cat = linkCategory(link);
        if (cat === 'danger') return DANGER_COLOR;
        if (cat === 'api') return API_COLOR;
        if (cat === 'bridge') return BRIDGE_COLOR;
        return ESSENTIAL_COLOR;
    };
    const getLinkResolution = () => (performanceMode === 'high-performance' ? 3 : 6);

    // Hover tooltip: which file connects to which, and what kind of link it is
    const getLinkLabel = (link: any) => {
        const src: any = typeof link.source === 'object' ? link.source : { label: link.source };
        const tgt: any = typeof link.target === 'object' ? link.target : { label: link.target };
        const cat = linkCategory(link);
        const color = cat === 'danger' ? DANGER_COLOR : cat === 'api' ? API_COLOR : cat === 'bridge' ? BRIDGE_COLOR : cat === 'essential' ? ESSENTIAL_COLOR : '#9fb3c8';
        return `<div style="background:#05060Aee;border:1px solid ${color};border-radius:8px;padding:6px 10px;font-size:11px;color:#e0e6ed">
            <b>${src.label}</b> → <b>${tgt.label}</b><br/>
            <span style="color:${color};font-weight:700;font-size:10px">${CATEGORY_NAMES[cat]}</span>
        </div>`;
    };

    if (typeof window === 'undefined') return null;

    // Tooltip follows the cursor for HOVERED nodes only; a selected node's
    // details live in the right sidebar (a pinned tooltip lingered over
    // overlay views otherwise).
    const activeNode = hoveredNode;

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
                    linkDirectionalParticleWidth={2.2}
                    linkDirectionalParticleColor={getParticleColor}
                    linkDirectionalParticleSpeed={0.005}
                    linkLabel={getLinkLabel}
                    backgroundColor="#00000000"
                    showNavInfo={false}
                    linkColor={getLinkColor}
                    nodeVisibility={isNodeVisible}
                    linkVisibility={isLinkVisible}
                    onNodeDrag={handleNodeDrag}
                    onNodeDragEnd={handleNodeDragEnd}
                    onEngineStop={() => {
                        if (!hasFittedRef.current && fgRef.current?.zoomToFit) {
                            hasFittedRef.current = true;
                            fgRef.current.zoomToFit(1000, 70);
                        }
                    }}
                    onNodeClick={(node: any) => {
                        if (zoomMode) focusOnNode(node);
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
                onMouseMove={(e) => setCursorPos({ x: e.clientX, y: e.clientY })}
            />

            {highlightInsight && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="bg-[#FF2E63]/15 border border-[#FF2E63]/50 px-5 py-2 rounded-full backdrop-blur flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#FF2E63] animate-pulse" />
                        <span className="text-xs text-[#FF8FA9] tracking-wide">{highlightInsight.title}</span>
                    </div>
                </div>
            )}

            {/* Move-module mode HUD */}
            {moveModuleMode && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="bg-[#FFD54F]/10 border border-[#FFD54F]/40 px-5 py-2 rounded-full backdrop-blur flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#FFD54F] animate-pulse" />
                        <span className="text-xs text-[#FFD54F] tracking-wide">MODO MOVER · arrastra la burbuja grande (o cualquier esfera) para mover TODO el módulo</span>
                    </div>
                </div>
            )}

            {/* Zoom mode HUD */}
            {zoomMode && !focusRoot && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="bg-[#00F0FF]/10 border border-[#00F0FF]/40 px-5 py-2 rounded-full backdrop-blur flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
                        <span className="text-xs text-[#00F0FF] tracking-wide">MODO ZOOM · haz clic en un archivo para aislar su cadena de conexiones</span>
                    </div>
                </div>
            )}
            {focusRoot && focusSet && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <div className="bg-[#00F0FF]/10 border border-[#00F0FF]/40 px-4 py-1.5 rounded-full backdrop-blur text-xs text-[#00F0FF]">
                        🔍 {focusRoot.label} · {focusSet.size - 1} archivos en su cadena (2 niveles)
                    </div>
                    <button
                        onClick={clearFocus}
                        className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] text-gray-300 hover:bg-white/20 transition-colors backdrop-blur"
                    >
                        ✕ Ver todo
                    </button>
                </div>
            )}

            {moduleStats.length > 0 && groupByModule && (
                <LegendPanel folderStats={moduleStats} onFolderHover={(id: string | null) => setHoveredModule(id)} />
            )}
        </div>
    );
}
