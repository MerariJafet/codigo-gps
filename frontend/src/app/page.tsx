"use client";

import { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import TopBar from '@/components/TopBar';
import SidebarLeft from '@/components/SidebarLeft';
import SidebarRight from '@/components/SidebarRight';
import GraphViz from '@/components/GraphViz';
import RepoLoader from '@/components/RepoLoader';
import NoProjectState from '@/components/NoProjectState';
import PerformancePanel, { PerformanceMode } from '@/components/PerformancePanel';
import { getTauriToken, isTauri, selectFolder } from '@/lib/tauri';
import LegendPanel from '@/components/LegendPanel';
import FileExplorerModal from '@/components/FileExplorerModal';
import { apiClient } from '@/lib/apiClient';

export default function Home() {
  const [currentPath, setCurrentPath] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready' | 'error'>('idle');

  const [perfMode, setPerfMode] = useState<PerformanceMode>('balanced');
  const [perfStats, setPerfStats] = useState({ fps: 60, nodeCount: 0, linkCount: 0 });
  const [groupByFolder, setGroupByFolder] = useState(false);

  const [showFileExplorer, setShowFileExplorer] = useState(false);

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

    // Health Check
    apiClient.health()
      .then(() => toast.success("System Online: Connected to Backend"))
      .catch(() => toast.error("Offline: Backend unreachable"));

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

  const handleRun = async () => {
    if (!currentPath) return;

    setStatus('scanning');
    setGraphData(null); // Clear previous

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await apiClient.post('/api/v1/analyze', { repo_path: currentPath }, { headers });

      if (!res.ok) throw new Error('Failed to analyze path');

      const data = await res.json();

      // Simulating sequence
      setTimeout(() => {
        setGraphData(data);
        setStatus('ready');
        toast.success(`Project Loaded: ${data.nodes.length} nodes found`);
      }, 1500);

    } catch (e) {
      setStatus('error');
      toast.error('Path invalid or analysis failed');
      console.error(e);
    }
  };

  const clearProject = () => {
    setGraphData(null);
    setStatus('idle');
    setSelectedNode(null);
  };

  return (
    <main className="flex flex-col w-screen h-screen bg-[#05060A] text-white overflow-hidden selection:bg-[#00F0FF] selection:text-black">
      <ToastContainer theme="dark" position="bottom-right" />

      {/* 1. Logic Controller Bar */}
      <TopBar
        currentPath={currentPath}
        onPathChange={setCurrentPath}
        onRun={handleRun}
        status={status}
        onClear={clearProject}
        onBrowse={async () => {
          if (isTauri()) {
            const selected = await selectFolder();
            if (selected) setCurrentPath(selected);
          } else {
            // Open Server-Side File Picker
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
          {status === 'scanning' && <RepoLoader />}

          {!graphData && status !== 'scanning' && <NoProjectState />}

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
