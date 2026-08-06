"use client";

import { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import dynamic from 'next/dynamic';

import TopBar from '@/components/TopBar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import RepoLoader from '@/components/RepoLoader';
import NoProjectState from '@/components/NoProjectState';
import PerformancePanel, { PerformanceMode } from '@/components/PerformancePanel';
import { getTauriToken, isTauri, selectFolder } from '@/lib/tauri';
import FileExplorerModal from '@/components/FileExplorerModal';
import { apiClient } from '@/lib/apiClient';
import RunOverlay, { RunState } from '@/components/RunOverlay';
import ViewTabs, { ViewMode } from '@/components/ViewTabs';
import DashboardView from '@/components/DashboardView';
import ModulesView from '@/components/ModulesView';
import MentorView from '@/components/MentorView';
import { GraphData, Insight, Node } from '@/types';

// Import GraphViz dynamically to avoid SSR hydration issues
const GraphViz = dynamic(() => import('@/components/GraphViz'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/20">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00F0FF] mx-auto mb-4"></div>
        <p className="text-[#00F0FF] text-sm">Cargando visualización 3D...</p>
      </div>
    </div>
  )
});

export default function Home() {
  const [currentPath, setCurrentPath] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready' | 'error'>('idle');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [perfMode, setPerfMode] = useState<PerformanceMode>('balanced');
  const [perfStats, setPerfStats] = useState({ fps: 60, nodeCount: 0, linkCount: 0 });
  const [groupByModule, setGroupByModule] = useState(true);

  // New: view system + insight highlighting + module focus
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [highlightInsight, setHighlightInsight] = useState<Insight | null>(null);
  const [focusModule, setFocusModule] = useState<string | null>(null);

  const [showFileExplorer, setShowFileExplorer] = useState(false);

  // Runtime mode detection
  const [runtimeMode, setRuntimeMode] = useState<'web' | 'tauri'>('web');

  // Run sequence state
  const [runState, setRunState] = useState<RunState>('idle');
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [runError, setRunError] = useState<string>('');

  useEffect(() => {
    const initAuth = async () => {
      const token = await getTauriToken();
      if (token) setAuthToken(token);
    };
    initAuth();

    const mode = isTauri() ? 'tauri' : 'web';
    setRuntimeMode(mode);

    checkBackendStatus();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const graphId = params.get('graph_id');
      if (graphId) loadFromGraphId(graphId);
    }
  }, []);

  const loadFromGraphId = async (id: string) => {
    setStatus('scanning');
    try {
      const headers: any = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await apiClient.get(`/api/v1/graphs/${id}`, { headers });
      if (!res.ok) throw new Error('Graph not found or API unavailable');

      const data = await res.json();
      setGraphData(data);
      setStatus('ready');
      toast.success('Análisis externo cargado');
    } catch (e) {
      setStatus('error');
      toast.error('No se pudo cargar el grafo externo');
      console.error(e);
    }
  };

  const checkBackendStatus = async (): Promise<boolean> => {
    try {
      await apiClient.health();
      setBackendOnline(true);
      return true;
    } catch (e) {
      setBackendOnline(false);
      return false;
    }
  };

  const addRunLog = (message: string) => {
    setRunLogs(prev => [...prev, message]);
  };

  const handleRun = async () => {
    if (!currentPath || currentPath.trim() === '') {
      const errorMsg = 'Selecciona primero la carpeta del proyecto.';
      setRunError(errorMsg);
      addRunLog(`ERROR: ${errorMsg}`);
      toast.error(errorMsg);
      return;
    }

    // Reset run state
    setRunState('connecting');
    setRunLogs([]);
    setRunError('');
    setGraphData(null);
    setHighlightInsight(null);
    setFocusModule(null);
    setViewMode('graph');
    setStatus('scanning');
    addRunLog(`Iniciando análisis de: ${currentPath}`);

    try {
      addRunLog('Conectando con el backend...');
      const backendAvailable = await checkBackendStatus();
      if (!backendAvailable) {
        throw new Error('El backend está apagado. Inícialo e intenta de nuevo.');
      }

      addRunLog('Conexión establecida');
      setRunState('indexing');
      addRunLog('Escaneando el proyecto...');
      setRunState('building');
      addRunLog('Analizando dependencias, módulos y vulnerabilidades...');

      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      // The local backend reads the path directly from disk — no upload,
      // so project size doesn't matter.
      const requestBody: any = { options: {}, repo_path: currentPath };

      const res = await apiClient.post('/api/v1/analyze', requestBody, { headers });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`El análisis falló: ${errorData.detail || errorData.error || res.statusText}`);
      }

      addRunLog('Grafo construido');
      setRunState('rendering');
      addRunLog('Inicializando holograma 3D...');

      const data: GraphData = await res.json();
      const insightCount = data.insights?.length || 0;
      addRunLog(`Listo: ${data.nodes.length} archivos, ${data.links.length} conexiones, ${data.modules?.length || 0} módulos, ${insightCount} hallazgos`);

      setGraphData(data);
      setRunState('ready');
      setStatus('ready');
      toast.success(`Proyecto cargado: ${data.nodes.length} archivos en ${data.modules?.length || 0} módulos`);
      if (insightCount > 0) {
        toast.warn(`El Maestro encontró ${insightCount} hallazgos para enseñarte`);
      }

    } catch (e: any) {
      console.error('Run failed:', e);
      setRunState('failed');
      setStatus('error');

      const errorMessage = e.message || 'Error desconocido durante el análisis';
      setRunError(errorMessage);
      addRunLog(`ERROR: ${errorMessage}`);
      toast.error(errorMessage);
    }
  };

  const clearProject = () => {
    setGraphData(null);
    setStatus('idle');
    setSelectedNode(null);
    setRunState('idle');
    setRunLogs([]);
    setRunError('');
    setHighlightInsight(null);
    setFocusModule(null);
    setViewMode('graph');
  };

  const goToNode = (nodeId: string) => {
    const node = graphData?.nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setViewMode('graph');
    }
  };

  const showInsightInGraph = (insight: Insight) => {
    setHighlightInsight(insight);
    setFocusModule(null);
    setViewMode('graph');
  };

  const exploreModule = (moduleId: string) => {
    setGroupByModule(true);
    setHighlightInsight(null);
    setFocusModule(moduleId);
    setViewMode('graph');
  };

  return (
    <main className="flex flex-col w-screen h-screen bg-[#05060A] text-white overflow-hidden selection:bg-[#00F0FF] selection:text-black">
      <ToastContainer theme="dark" position="bottom-right" />

      <RunOverlay
        isVisible={runState !== 'idle' && runState !== 'ready'}
        currentState={runState}
        logs={runLogs}
        error={runError}
        onCancel={() => {
          setRunState('idle');
          setStatus('idle');
          setRunLogs([]);
          setRunError('');
        }}
      />

      {/* 1. Logic Controller Bar */}
      <TopBar
        currentPath={currentPath}
        onPathChange={setCurrentPath}
        onRun={handleRun}
        status={status}
        onClear={clearProject}
        backendOnline={backendOnline}
        runState={runState}
        runtimeMode={runtimeMode}
        onBrowse={async () => {
          if (isTauri()) {
            const selected = await selectFolder();
            if (selected) setCurrentPath(selected);
          } else {
            setShowFileExplorer(true);
          }
        }}
      />

      <FileExplorerModal
        isOpen={showFileExplorer}
        onClose={() => setShowFileExplorer(false)}
        onSelect={(path) => {
          setCurrentPath(path);
          setShowFileExplorer(false);
        }}
        initialPath={currentPath}
      />

      {/* 2. Tri-Panel Layout */}
      <div className="flex flex-1 relative overflow-hidden">

        {/* Panel A: Left */}
        <SidebarLeft
          data={graphData}
          onNodeSelect={goToNode}
          groupByModule={groupByModule}
          setGroupByModule={setGroupByModule}
        />

        {/* Panel B: Center (Stage) */}
        <div className="flex-1 relative bg-black/20 flex flex-col">

          {runState !== 'idle' && runState !== 'ready' && <RepoLoader />}

          {!graphData && status !== 'scanning' && <NoProjectState hasSelectedFolder={!!currentPath} runState={runState} />}

          <div className={`w-full h-full transition-opacity duration-1000 ${status === 'scanning' ? 'opacity-0' : 'opacity-100'}`}>
            <GraphViz
              data={graphData || { nodes: [], links: [] }}
              onNodeClick={setSelectedNode}
              performanceMode={perfMode}
              onStatsUpdate={setPerfStats}
              groupByModule={groupByModule}
              highlightInsight={highlightInsight}
              focusModule={focusModule}
            />
          </div>

          {/* View tabs */}
          {graphData && (
            <ViewTabs
              active={viewMode}
              onChange={(v) => {
                setViewMode(v);
                if (v !== 'graph') setFocusModule(null);
              }}
              insightCount={(graphData.insights || []).filter(i => i.severity !== 'info').length}
            />
          )}

          {/* Clear insight highlight chip */}
          {graphData && viewMode === 'graph' && highlightInsight && (
            <button
              onClick={() => setHighlightInsight(null)}
              className="absolute top-[4.5rem] left-1/2 -translate-x-1/2 z-40 px-4 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] text-gray-300 hover:bg-white/20 transition-colors backdrop-blur"
            >
              ✕ Quitar resaltado rojo
            </button>
          )}

          {/* Overlay views */}
          {graphData && viewMode === 'dashboard' && (
            <DashboardView
              data={graphData}
              onSelectModule={exploreModule}
              onGoToMentor={() => setViewMode('mentor')}
              onSelectNode={goToNode}
            />
          )}
          {graphData && viewMode === 'modules' && (
            <ModulesView
              data={graphData}
              onExploreModule={exploreModule}
              onSelectNode={goToNode}
            />
          )}
          {graphData && viewMode === 'mentor' && (
            <MentorView
              data={graphData}
              onShowInGraph={showInsightInGraph}
            />
          )}

          {/* Performance Panel */}
          {graphData && viewMode === 'graph' && (
            <PerformancePanel
              currentMode={perfMode}
              onModeChange={setPerfMode}
              stats={perfStats}
            />
          )}
        </div>

        {/* Panel C: Right */}
        <SidebarRight node={selectedNode} data={graphData} onShowInsight={showInsightInGraph} />

      </div>
    </main>
  );
}
