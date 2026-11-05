import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface TacticalRadarProps {
  size?: number;
  activeRegion?: string;
}

export const ThreeTacticalRadar: React.FC<TacticalRadarProps> = ({
  size = 140,
  activeRegion = 'Wayanad, Kerala',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);

  useEffect(() => {
    // Verify WebGL availability
    if (typeof window === 'undefined' || !window.WebGLRenderingContext) {
      setHasWebGL(false);
      return;
    }

    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);
    } catch {
      setHasWebGL(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 3.6;

    // Outer wireframe globe
    const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const globe = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(globe);

    // Inner core glowing sphere
    const coreGeo = new THREE.SphereGeometry(0.75, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x1e3a8a,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Rotating Radar Sweep Ring
    const ringGeo = new THREE.RingGeometry(1.25, 1.3, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.3;
    scene.add(ring);

    // Disaster Incident Marker Pulses (India Lat/Lon projection on sphere)
    const incidentGroup = new THREE.Group();
    const incidentPoints = [
      { name: 'Wayanad', lat: 11.6, lon: 76.1, color: 0x10b981 },
      { name: 'Chamoli', lat: 30.5, lon: 79.5, color: 0xf59e0b },
      { name: 'Majuli', lat: 26.9, lon: 94.2, color: 0xef4444 },
    ];

    incidentPoints.forEach((pt) => {
      const phi = (90 - pt.lat) * (Math.PI / 180);
      const theta = (pt.lon + 180) * (Math.PI / 180);
      const x = -(1.22 * Math.sin(phi) * Math.cos(theta));
      const z = 1.22 * Math.sin(phi) * Math.sin(theta);
      const y = 1.22 * Math.cos(phi);

      const markerGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const markerMat = new THREE.MeshBasicMaterial({ color: pt.color });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(x, y, z);
      incidentGroup.add(marker);
    });
    scene.add(incidentGroup);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      globe.rotation.y += delta * 0.4;
      core.rotation.y -= delta * 0.3;
      ring.rotation.z += delta * 1.2;
      incidentGroup.rotation.y += delta * 0.4;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sphereGeo.dispose();
      sphereMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, [size]);

  if (!hasWebGL) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-slate-900/40 border border-blue-500/30 text-blue-400 text-xs font-mono"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] text-center p-2">3D Radar [Ready]</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div
        ref={mountRef}
        style={{ width: size, height: size }}
        className="relative cursor-pointer transition-transform duration-500 hover:scale-105"
        title={`CrisisRoute Tactical Radar — Active Corridor: ${activeRegion}`}
      />
      <div className="absolute bottom-0 text-[10px] font-mono tracking-wider uppercase text-blue-400/80 bg-slate-900/60 px-2 py-0.5 rounded-full border border-blue-500/20 backdrop-blur-xs">
        Tactical 3D Radar
      </div>
    </div>
  );
};
