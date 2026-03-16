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
import LegendPanel from '@/components/LegendPanel';
import FileExplorerModal from '@/components/FileExplorerModal';
import { apiClient } from '@/lib/apiClient';
import RunOverlay, { RunState } from '@/components/RunOverlay';

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
  const [graphData, setGraphData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready' | 'error'>('idle');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [perfMode, setPerfMode] = useState<PerformanceMode>('balanced');
  const [perfStats, setPerfStats] = useState({ fps: 60, nodeCount: 0, linkCount: 0 });
  const [groupByFolder, setGroupByFolder] = useState(false);

  const [showFileExplorer, setShowFileExplorer] = useState(false);

  // Runtime mode detection
  const [runtimeMode, setRuntimeMode] = useState<'web' | 'tauri'>('web');
  const [fileManifest, setFileManifest] = useState<any[]>([]);

  // Run sequence state
  const [runState, setRunState] = useState<RunState>('idle');
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [runError, setRunError] = useState<string>('');

  useEffect(() => {
    // Initialize Auth
    const initAuth = async () => {
      const token = await getTauriToken();
      if (token) {
        setAuthToken(token);
        console.log("Auth Token Loaded from Tauri");
      }
    };
    initAuth();

    // Detect runtime mode
    const mode = isTauri() ? 'tauri' : 'web';
    setRuntimeMode(mode);
    console.log(`Runtime mode: ${mode.toUpperCase()}`);

    // Initial backend status check
    checkBackendStatus();

    // Check for graph_id in URL params if we are in service mode
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const graphId = params.get('graph_id');
      if (graphId) {
        loadFromGraphId(graphId);
      }
    }
  }, []);

  const loadFromGraphId = async (id: string) => {
    setStatus('scanning');
    try {
      // Adjust valid endpoint
      const headers: any = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await apiClient.get(`/api/v1/graphs/${id}`, { headers });
      if (!res.ok) throw new Error('Graph not found or API unavailable');

      const data = await res.json();
      setGraphData(data);
      setStatus('ready');
      toast.success('Services: External Analysis Loaded');
    } catch (e) {
      setStatus('error');
      toast.error('Failed to load external graph');
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
    // Explicit validation: RUN requires a valid project path
    if (!currentPath || currentPath.trim() === '') {
      const errorMsg = 'No project path selected. Please select a folder first.';
      setRunError(errorMsg);
      addRunLog(`ERROR: ${errorMsg}`);
      toast.error(errorMsg);
      return;
    }

    addRunLog(`Starting analysis for project: ${currentPath}`);

    // Reset run state
    setRunState('connecting');
    setRunLogs([]);
    setRunError('');
    setGraphData(null);
    setStatus('scanning');

    try {
      // Step 1: CONNECTING BACKEND
      addRunLog('Initiating backend connection...');
      const backendAvailable = await checkBackendStatus();

      if (!backendAvailable) {
        throw new Error('Backend service is offline. Please start the backend service and try again.');
      }

      addRunLog('Backend connection established');
      setRunState('indexing');

      // Step 2: INDEXING FILES (simulated)
      addRunLog('Scanning project directory...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      addRunLog(`Found project files in: ${currentPath}`);

      setRunState('building');

      // Step 3: BUILDING GRAPH
      addRunLog('Analyzing file dependencies...');
      addRunLog(`API Base URL: ${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}`);
      addRunLog(`Analysis endpoint: /api/v1/analyze`);

      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      let requestBody: any = { options: {} };
      if (runtimeMode === 'tauri') {
        requestBody.repo_path = currentPath;
      } else {
        // Web mode: send file manifest
        requestBody.file_manifest = fileManifest.map(f => ({
          path: f.path,
          content: f.content,
          size: f.size
        }));
      }

      const res = await apiClient.post('/api/v1/analyze', requestBody, { headers });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Analysis failed: ${errorData.detail || res.statusText}`);
      }

      addRunLog('Graph construction completed');
      setRunState('rendering');

      // Step 4: RENDERING HOLOGRAM
      addRunLog('Initializing 3D visualization...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const data = await res.json();
      addRunLog(`Visualization ready: ${data.nodes.length} nodes, ${data.links.length} connections`);

      setGraphData(data);
      setRunState('ready');
      setStatus('ready');
      toast.success(`Project Loaded: ${data.nodes.length} nodes found`);

    } catch (e: any) {
      console.error('Run failed:', e);
      setRunState('failed');
      setStatus('error');

      const errorMessage = e.message || 'Unknown error occurred during analysis';
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
          console.log('🔍 Browse button clicked');
          if (isTauri()) {
            console.log('🔍 Using Tauri folder picker');
            const selected = await selectFolder();
            if (selected) setCurrentPath(selected);
          } else {
            console.log('🔍 Opening web FileExplorerModal');
            // Open Server-Side File Picker
            setShowFileExplorer(true);
          }
        }}
      />

      <FileExplorerModal
        isOpen={showFileExplorer}
        onClose={() => setShowFileExplorer(false)}
        onSelect={(path, fileManifest) => {
          setCurrentPath(path);
          if (fileManifest) {
            setFileManifest(fileManifest);
            console.log(`Collected ${fileManifest.length} files for web analysis`);
          }
          setShowFileExplorer(false);
        }}
        initialPath={currentPath}
        collectFiles={runtimeMode === 'web'}
      />

      {/* 2. Tri-Panel Layout (Natalia's Request) */}
      <div className="flex flex-1 relative overflow-hidden">

        {/* Panel A: Left (20% - Fixed width handled by component) */}
        {/* Panel A: Left (20% - Fixed width handled by component) */}
        <SidebarLeft
          data={graphData}
          onNodeSelect={(nodeId: string) => {
            // Find node obj
            const node = graphData.nodes.find((n: any) => n.id === nodeId);
            if (node) setSelectedNode(node);
          }}
          groupByFolder={groupByFolder}
          setGroupByFolder={setGroupByFolder}
        />

        {/* Panel B: Center (Stage) */}
        <div className="flex-1 relative bg-black/20 flex flex-col">

          {/* Layers */}
          {runState !== 'idle' && runState !== 'ready' && <RepoLoader />}

          {!graphData && status !== 'scanning' && <NoProjectState hasSelectedFolder={!!currentPath} runState={runState} />}

          <div className={`w-full h-full transition-opacity duration-1000 ${status === 'scanning' ? 'opacity-0' : 'opacity-100'}`}>
            {/* Only render graph if we have data, but keep div to maintain layout */}
            <GraphViz
              data={graphData || { nodes: [], links: [] }}
              onNodeClick={setSelectedNode}
              performanceMode={perfMode}
              onStatsUpdate={setPerfStats}
              groupByFolder={groupByFolder}
            />
          </div>

          {/* Center Overlay HUD */}
          {graphData && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-[#00F0FF]/10 border border-[#00F0FF]/30 px-4 py-1 rounded-full backdrop-blur">
                <span className="text-[10px] tracking-[0.2em] text-[#00F0FF]">INTERACTIVE VIEW // ORBITAL</span>
              </div>
            </div>
          )}



          {/* Performance Panel */}
          {graphData && (
            <PerformancePanel
              currentMode={perfMode}
              onModeChange={setPerfMode}
              stats={perfStats}
            />
          )}
        </div>

        {/* Panel C: Right */}
        <SidebarRight node={selectedNode} />

      </div>
    </main>
  );
}
