// Full-screen transparent WebGL scene: the AI core plus a deep-space
// environment (subtle grid, digital dust, fog). UI lives above it.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { JarvisCore } from "./JarvisCore";
import { glowTexture } from "./glow";
import { useCore } from "../store";

function Dust() {
  const ref = useRef<THREE.Points>(null!);
  const count = 260;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return arr;
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const st = useCore.getState();
    if (st.reducedMotion) return;
    ref.current.rotation.y += dt * 0.008;
    ref.current.position.y = Math.sin(performance.now() / 8000) * 0.4;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={glowTexture()} color="#3f7db0" size={0.05} sizeAttenuation transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Grid() {
  const ref = useRef<THREE.GridHelper>(null!);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const st = useCore.getState();
    ref.current.position.y = -2.6 + Math.sin(performance.now() / 10000) * 0.15;
    if (!st.reducedMotion) ref.current.rotation.z += dt * 0.004;
  });
  return (
    <gridHelper
      ref={ref}
      args={[60, 48, "#1a4a6a", "#0c2338"]}
      position={[0, -2.6, -2]}
      onUpdate={(g) => {
        const m = (g as THREE.GridHelper).material as THREE.Material;
        m.transparent = true;
        m.opacity = 0.28;
        m.depthWrite = false;
      }}
    />
  );
}

export function Scene() {
  const quality = useCore((s) => s.quality);
  const dpr = quality === "high" ? [1, 2] : quality === "medium" ? [1, 1.5] : [1, 1];
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 45 }}
      dpr={dpr as [number, number]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <fog attach="fog" args={["#04070d", 9, 26]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[6, 4, 6]} intensity={30} color="#3fb4e0" />
      <JarvisCore />
      <Grid />
      <Dust />
    </Canvas>
  );
}
