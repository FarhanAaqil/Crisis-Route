import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { PassabilityEdgeItem, PassabilityNodeItem } from '../api/client';
import { RotateCcw, Eye, Play, Pause, Navigation, ShieldAlert } from 'lucide-react';

interface ThreeCorridorVisualizerProps {
  edges: PassabilityEdgeItem[];
  nodes: PassabilityNodeItem[];
  selectedEdgeId?: string;
  onSelectEdge?: (edge: PassabilityEdgeItem) => void;
  regionName?: string;
}

export const ThreeCorridorVisualizer: React.FC<ThreeCorridorVisualizerProps> = ({
  edges,
  nodes,
  selectedEdgeId,
  onSelectEdge,
  regionName = 'Disaster Relief Sector',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [hoveredEdge, setHoveredEdge] = useState<PassabilityEdgeItem | null>(null);
  const [isAnimatingFleet, setIsAnimatingFleet] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<'perspective' | 'topDown'>('perspective');

  // Compute node coordinate bounding box to normalize 3D coordinates into centered [-12, 12]
  const nodeMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; z: number; node: PassabilityNodeItem }>();
    if (nodes.length === 0) return map;

    let minLon = Infinity,
      maxLon = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;

    nodes.forEach((n) => {
      const lon = n.coordinates[0];
      const lat = n.coordinates[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    const lonSpan = maxLon - minLon || 0.1;
    const latSpan = maxLat - minLat || 0.1;

    nodes.forEach((n) => {
      const lon = n.coordinates[0];
      const lat = n.coordinates[1];
      // Scale into [-12, 12] range for 3D scene
      const x = ((lon - minLon) / lonSpan - 0.5) * 24;
      const z = -(((lat - minLat) / latSpan - 0.5) * 24);
      // Elevation based on node type
      const y = n.node_type === 'depot' ? 0.6 : 0.2;
      map.set(n.node_id, { x, y, z, node: n });
    });

    return map;
  }, [nodes]);

  // References to mutable Three.js objects for animation loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const convoyParticlesRef = useRef<Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; progress: number; speed: number }>>([]);
  const edgeMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.WebGLRenderingContext) {
      setHasWebGL(false);
      return;
    }

    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth || 800, 520);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch {
      setHasWebGL(false);
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0f172a, 0.015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, (container.clientWidth || 800) / 520, 0.1, 1000);
    camera.position.set(0, 22, 28);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Ambient and Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x60a5fa, 1.2);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 1.5, 50);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    // 3D Topographical Grid Floor
    const gridHelper = new THREE.GridHelper(34, 34, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    // Terrain Contour Mesh with subtle elevation waves
    const terrainGeo = new THREE.PlaneGeometry(36, 36, 24, 24);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      // Generate synthetic mountain/valley relief
      const elevation = Math.sin(vx * 0.25) * Math.cos(vz * 0.25) * 1.2 - 0.4;
      pos.setY(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.2,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.y = -0.5;
    scene.add(terrain);

    // Build 3D Nodes
    const nodeGeometryDepot = new THREE.CylinderGeometry(0.7, 0.7, 0.8, 6);
    const nodeGeometryDemand = new THREE.SphereGeometry(0.5, 16, 16);
    const nodeGeometryJunction = new THREE.OctahedronGeometry(0.4);

    nodeMap.forEach((data) => {
      let nodeMesh: THREE.Mesh;
      if (data.node.node_type === 'depot') {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          emissive: 0x1d4ed8,
          emissiveIntensity: 0.6,
          metalness: 0.5,
          roughness: 0.3,
        });
        nodeMesh = new THREE.Mesh(nodeGeometryDepot, mat);
        nodeMesh.position.set(data.x, data.y + 0.4, data.z);

        // Glowing outer halo
        const haloGeo = new THREE.RingGeometry(0.9, 1.2, 16);
        haloGeo.rotateX(-Math.PI / 2);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0x60a5fa,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.set(data.x, 0.1, data.z);
        scene.add(halo);
      } else if (data.node.node_type === 'demand') {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x047857,
          emissiveIntensity: 0.4,
          metalness: 0.3,
          roughness: 0.4,
        });
        nodeMesh = new THREE.Mesh(nodeGeometryDemand, mat);
        nodeMesh.position.set(data.x, data.y + 0.5, data.z);
      } else {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xb45309,
          emissiveIntensity: 0.3,
        });
        nodeMesh = new THREE.Mesh(nodeGeometryJunction, mat);
        nodeMesh.position.set(data.x, data.y + 0.4, data.z);
      }
      scene.add(nodeMesh);
    });

    // Build 3D Corridors (Tubes & Arcs)
    edgeMeshMapRef.current.clear();
    convoyParticlesRef.current = [];

    const convoyGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const convoyMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });

    edges.forEach((edge) => {
      const u = nodeMap.get(edge.u_node);
      const v = nodeMap.get(edge.v_node);
      if (!u || !v) return;

      const p1 = new THREE.Vector3(u.x, u.y, u.z);
      const p2 = new THREE.Vector3(v.x, v.y, v.z);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      
      // Arc elevation based on passability and length
      const dist = p1.distanceTo(p2);
      mid.y += Math.min(dist * 0.15, 2.5);

      const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.12, 8, false);

      // Color coding: Green >= 0.70, Amber 0.40 - 0.70, Crimson < 0.40
      let corridorColor = 0x10b981;
      let emissiveColor = 0x059669;
      if (edge.passability_prob < 0.40) {
        corridorColor = 0xef4444;
        emissiveColor = 0xb91c1c;
      } else if (edge.passability_prob < 0.70) {
        corridorColor = 0xf59e0b;
        emissiveColor = 0xd97706;
      }

      const isSelected = edge.edge_id === selectedEdgeId;
      const tubeMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x38bdf8 : corridorColor,
        emissive: isSelected ? 0x0284c7 : emissiveColor,
        emissiveIntensity: isSelected ? 0.9 : 0.4,
        roughness: 0.3,
        metalness: 0.2,
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.userData = { edge };
      scene.add(tubeMesh);
      edgeMeshMapRef.current.set(edge.edge_id, tubeMesh);

      // High-risk bridge hazard pyramid marker
      if (edge.bridge) {
        const hazardGeo = new THREE.ConeGeometry(0.35, 0.7, 4);
        const hazardMat = new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0xe11d48,
          emissiveIntensity: 0.8,
        });
        const hazardCone = new THREE.Mesh(hazardGeo, hazardMat);
        hazardCone.position.copy(mid);
        hazardCone.position.y += 0.5;
        scene.add(hazardCone);
      }

      // Convoy particles for viable routes (p >= 0.40)
      if (edge.passability_prob >= 0.40) {
        const particleMesh = new THREE.Mesh(convoyGeo, convoyMat);
        particleMesh.position.copy(p1);
        scene.add(particleMesh);
        convoyParticlesRef.current.push({
          mesh: particleMesh,
          curve,
          progress: Math.random(),
          speed: 0.003 + Math.random() * 0.004,
        });
      }
    });

    // Mouse Interaction: Orbit Rotation and Raycasting
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotationVelocityX = 0.002; // Initial slow auto-rotation

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      rotationVelocityX = 0;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      // Raycasting for edge hover
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
      const meshes = Array.from(edgeMeshMapRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const targetEdge = intersects[0].object.userData.edge as PassabilityEdgeItem;
        setHoveredEdge(targetEdge);
        document.body.style.cursor = 'pointer';
      } else {
        setHoveredEdge(null);
        document.body.style.cursor = 'default';
      }

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        scene.rotation.y += deltaX * 0.008;
        camera.position.y = Math.max(5, Math.min(45, camera.position.y - deltaY * 0.08));
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.02;
      const newDistance = camera.position.length() + zoomFactor;
      if (newDistance > 8 && newDistance < 60) {
        camera.position.multiplyScalar(newDistance / camera.position.length());
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    // Click handler to select corridor
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
      const meshes = Array.from(edgeMeshMapRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const targetEdge = intersects[0].object.userData.edge as PassabilityEdgeItem;
        if (onSelectEdge) onSelectEdge(targetEdge);
      }
    };
    domElement.addEventListener('click', onClick);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Auto rotation when not dragging
      if (!isDragging && rotationVelocityX !== 0) {
        scene.rotation.y += rotationVelocityX;
      }

      // Convoy particles animation
      if (isAnimatingFleet) {
        convoyParticlesRef.current.forEach((convoy) => {
          convoy.progress += convoy.speed;
          if (convoy.progress > 1) convoy.progress = 0;
          const pos = convoy.curve.getPoint(convoy.progress);
          convoy.mesh.position.copy(pos);
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      camera.aspect = width / 520;
      camera.updateProjectionMatrix();
      renderer.setSize(width, 520);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [edges, nodes, nodeMap, isAnimatingFleet, onSelectEdge]);

  // Adjust camera to top-down or perspective preset
  const handleToggleCamera = (mode: 'perspective' | 'topDown') => {
    setCameraMode(mode);
    if (!cameraRef.current || !sceneRef.current) return;
    if (mode === 'topDown') {
      cameraRef.current.position.set(0, 38, 0.1);
      cameraRef.current.lookAt(0, 0, 0);
      sceneRef.current.rotation.y = 0;
    } else {
      cameraRef.current.position.set(0, 22, 28);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  const handleResetView = () => {
    if (!cameraRef.current || !sceneRef.current) return;
    cameraRef.current.position.set(0, 22, 28);
    cameraRef.current.lookAt(0, 0, 0);
    sceneRef.current.rotation.y = 0;
    setCameraMode('perspective');
  };

  if (!hasWebGL) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white text-center">
        <h4 className="text-base font-bold text-blue-400 mb-2">3D Tactical Visualizer [Compatibility Mode]</h4>
        <p className="text-xs text-slate-400 mb-4">
          WebGL hardware acceleration is inactive in this viewport. Displaying network topological matrix:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-slate-400">Total Corridors</div>
            <div className="text-lg font-bold text-white">{edges.length}</div>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-slate-400">Staging Nodes</div>
            <div className="text-lg font-bold text-blue-400">{nodes.length}</div>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-slate-400">High Risk Corridors</div>
            <div className="text-lg font-bold text-rose-400">
              {edges.filter((e) => e.passability_prob < 0.4).length}
            </div>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
            <div className="text-slate-400">Active Bridge Links</div>
            <div className="text-lg font-bold text-amber-400">{edges.filter((e) => e.bridge).length}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-sans">
      {/* 3D Visualizer Header Controls HUD */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-lg flex items-center space-x-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
              <span>Tactical 3D Topographical Grid</span>
              <span className="text-[10px] bg-blue-600/40 text-blue-300 px-1.5 py-0.2 rounded font-mono">
                Three.js
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-xs">{regionName}</p>
          </div>
        </div>

        {/* Viewport Control Buttons */}
        <div className="pointer-events-auto flex items-center space-x-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs">
          <button
            type="button"
            onClick={() => handleToggleCamera(cameraMode === 'perspective' ? 'topDown' : 'perspective')}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
              cameraMode === 'perspective'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Perspective 3D vs Top-Down View"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{cameraMode === 'perspective' ? 'Perspective 3D' : 'Planar 2D'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAnimatingFleet(!isAnimatingFleet)}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
              isAnimatingFleet ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Toggle Fleet Convoy Simulation"
          >
            {isAnimatingFleet ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Fleet Pulse</span>
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reset Camera Orientation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Mount Point */}
      <div
        ref={mountRef}
        className="w-full h-[520px] cursor-grab active:cursor-grabbing outline-none"
        tabIndex={0}
        aria-label="Interactive 3D Corridor Topographical Model"
      />

      {/* Floating Tactical Corridor HUD Card on Hover / Selection */}
      {(hoveredEdge || selectedEdgeId) && (
        <div className="absolute bottom-4 left-4 z-10 max-w-sm w-full bg-slate-900/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs space-y-2 pointer-events-auto">
          {(() => {
            const edge = hoveredEdge || edges.find((e) => e.edge_id === selectedEdgeId);
            if (!edge) return null;
            const probPct = (edge.passability_prob * 100).toFixed(0);
            const isHighRisk = edge.passability_prob < 0.4;
            const isMediumRisk = edge.passability_prob >= 0.4 && edge.passability_prob < 0.7;

            return (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <Navigation className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-mono font-bold text-slate-100">{edge.edge_id}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isHighRisk
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : isMediumRisk
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isHighRisk ? 'Critical Hazard' : isMediumRisk ? 'Caution' : 'Passable'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 text-center">
                  <div className="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                    <div className="text-[10px] text-slate-400">Passability</div>
                    <div className={`font-mono font-bold ${isHighRisk ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {probPct}%
                    </div>
                  </div>
                  <div className="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                    <div className="text-[10px] text-slate-400">Class</div>
                    <div className="font-semibold text-slate-200 capitalize">{edge.road_class}</div>
                  </div>
                  <div className="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                    <div className="text-[10px] text-slate-400">Length</div>
                    <div className="font-mono text-slate-200">{edge.length_m ? `${edge.length_m}m` : '—'}</div>
                  </div>
                </div>

                {edge.bridge && (
                  <div className="flex items-center space-x-1.5 text-rose-300 bg-rose-950/40 px-2 py-1 rounded border border-rose-800/40 text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>Bridge Structure — Vulnerable to Riverine Inundation</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* 3D Legend HUD */}
      <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center space-x-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-300 pointer-events-none">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Passable (≥70%)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span>Caution (40-70%)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
          <span>Blocked (&lt;40%)</span>
        </div>
        <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-700">
          <span className="w-2 h-2 rounded-xs bg-blue-500 inline-block" />
          <span>Depot</span>
        </div>
      </div>
    </div>
  );
};
