// ─────────────────────────────────────────────────────────────────────────────
// JARVIS AI CORE — the visual identity of the command center.
// A holographic energy sphere with gimbal rings, orbiting nodes, a neural
// particle field, scan arcs, a live audio waveform and volumetric glow.
// Every state (IDLE / LISTENING / THINKING / SPEAKING / EXECUTING / SUCCESS /
// WARNING / ERROR / OFFLINE) drives distinct color + motion behaviour.
// Performance: reads store values imperatively in useFrame (no re-renders),
// adaptive particle counts by quality, and reduced-motion support.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCore } from "../store";
import { glowTexture } from "./glow";
import type { CoreState } from "../types";

export interface StatePalette {
  rim: string;
  base: string;
  inner: string;
  intensity: number;
  speed: number;
}

export const STATE_PALETTES: Record<CoreState, StatePalette> = {
  BOOT: { rim: "#7ff3ff", base: "#062033", inner: "#0e8bb8", intensity: 1.6, speed: 1.2 },
  IDLE: { rim: "#22d3ee", base: "#071c2e", inner: "#0d6ea0", intensity: 1.0, speed: 1.0 },
  LISTENING: { rim: "#7ff3ff", base: "#08304a", inner: "#14a8d8", intensity: 1.55, speed: 1.8 },
  THINKING: { rim: "#8b5cf6", base: "#150f35", inner: "#3b2a8f", intensity: 1.5, speed: 2.2 },
  SPEAKING: { rim: "#5eead4", base: "#07303f", inner: "#0fa8a0", intensity: 1.5, speed: 1.6 },
  EXECUTING: { rim: "#38bdf8", base: "#06283f", inner: "#0c7fd0", intensity: 1.7, speed: 2.4 },
  SUCCESS: { rim: "#34d399", base: "#04251a", inner: "#0a9a6a", intensity: 1.8, speed: 1.4 },
  WARNING: { rim: "#fbbf24", base: "#2b1d05", inner: "#b4760a", intensity: 1.6, speed: 1.1 },
  ERROR: { rim: "#f87171", base: "#2b0707", inner: "#b91c1c", intensity: 1.7, speed: 1.2 },
  OFFLINE: { rim: "#64748b", base: "#0d1117", inner: "#374151", intensity: 0.6, speed: 0.5 },
};

// ── Energy sphere (custom shader) ─────────────────────────────────────────────
const VERT = /* glsl */ `
  varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    vPos = position;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uRim; uniform vec3 uBase; uniform vec3 uInner; uniform float uIntensity;
  varying vec3 vNormal; varying vec3 vView; varying vec3 vPos;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vNormal); vec3 v = normalize(vView);
    float fres = pow(1.0 - abs(dot(n, v)), 2.2);
    float bands  = sin(vPos.y * 26.0 + uTime * 1.5) * 0.5 + 0.5;
    float bands2 = sin(vPos.x * 18.0 - uTime * 1.1) * 0.5 + 0.5;
    float noise = hash(floor(vPos * 42.0));
    vec3 col = mix(uBase, uInner, bands * 0.6 + bands2 * 0.2);
    col += uRim * fres * (1.35 + 0.45 * sin(uTime * 2.1));
    col += uRim * bands * fres * 0.55;
    col += vec3(0.6, 0.9, 1.0) * noise * fres * 0.10;
    float alpha = clamp(fres * 1.35 + 0.14, 0.0, 1.0);
    gl_FragColor = vec4(col * uIntensity, alpha);
  }
`;

function EnergySphere({ rim, base, inner }: { rim: React.MutableRefObject<THREE.Color>; base: React.MutableRefObject<THREE.Color>; inner: React.MutableRefObject<THREE.Color> }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uRim: { value: rim.current }, uBase: { value: base.current }, uInner: { value: inner.current }, uIntensity: { value: 1 } }),
    [rim, base, inner],
  );
  useFrame((_, dt) => {
    uniforms.uTime.value += dt * (useCore.getState().reducedMotion ? 0.2 : 1);
    const pal = STATE_PALETTES[useCore.getState().state] ?? STATE_PALETTES.IDLE;
    uniforms.uIntensity.value += (pal.intensity - uniforms.uIntensity.value) * Math.min(1, dt * 4);
  });
  return (
    <mesh>
      <icosahedronGeometry args={[1.12, 5]} />
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Gimbal rings ──────────────────────────────────────────────────────────────
function Ring({ radius, tube, tilt, speed, rim }: { radius: number; tube: number; tilt: [number, number, number]; speed: number; rim: React.MutableRefObject<THREE.Color> }) {
  const ref = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const st = useCore.getState();
    const pal = STATE_PALETTES[st.state] ?? STATE_PALETTES.IDLE;
    const rm = st.reducedMotion ? 0.15 : 1;
    ref.current.rotation.x += dt * speed * pal.speed * 0.35 * rm;
    ref.current.rotation.y += dt * speed * pal.speed * 0.22 * rm;
    if (matRef.current) matRef.current.color.lerp(rim.current, Math.min(1, dt * 6));
  });
  return (
    <group rotation={tilt}>
      <mesh ref={ref}>
        <torusGeometry args={[radius, tube, 8, 140]} />
        <meshBasicMaterial ref={matRef} color={rim.current} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Neural particle field ─────────────────────────────────────────────────────
function Particles({ rim, count }: { rim: React.MutableRefObject<THREE.Color>; count: number }) {
  const ref = useRef<THREE.Points>(null!);
  const matRef = useRef<THREE.PointsMaterial>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.4 + Math.random() * 2.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const st = useCore.getState();
    const pal = STATE_PALETTES[st.state] ?? STATE_PALETTES.IDLE;
    ref.current.rotation.y += dt * 0.06 * pal.speed * (st.reducedMotion ? 0.1 : 1);
    ref.current.rotation.x += dt * 0.02 * (st.reducedMotion ? 0.1 : 1);
    if (matRef.current) matRef.current.color.lerp(rim.current, Math.min(1, dt * 6));
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        map={glowTexture()}
        color={rim.current}
        size={0.055}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Orbiting nodes + neural constellation ─────────────────────────────────────
function Constellation({ rim }: { rim: React.MutableRefObject<THREE.Color> }) {
  const group = useRef<THREE.Group>(null!);
  const lineMat = useRef<THREE.LineBasicMaterial>(null!);
  const { nodes, segments } = useMemo(() => {
    const N = 12;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const r = 1.65 + (i % 3) * 0.18;
      const theta = (i / N) * Math.PI * 2;
      const phi = Math.acos(2 * ((i * 0.618) % 1) - 1);
      pts.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
    }
    const seg: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % N]!;
      const c = pts[(i + 5) % N]!;
      seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      seg.push(a.x, a.y, a.z, c.x, c.y, c.z);
    }
    return { nodes: pts, segments: new Float32Array(seg) };
  }, []);
  useFrame((_, dt) => {
    if (!group.current) return;
    const st = useCore.getState();
    const pal = STATE_PALETTES[st.state] ?? STATE_PALETTES.IDLE;
    group.current.rotation.y += dt * 0.16 * pal.speed * (st.reducedMotion ? 0.1 : 1);
    group.current.rotation.z += dt * 0.05 * (st.reducedMotion ? 0.1 : 1);
    if (lineMat.current) lineMat.current.color.lerp(rim.current, Math.min(1, dt * 6));
  });
  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[segments, 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={lineMat} color={rim.current} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshBasicMaterial color={rim.current} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Scan arc + expanding pulse ring ───────────────────────────────────────────
function ScanSystem({ rim }: { rim: React.MutableRefObject<THREE.Color> }) {
  const arc = useRef<THREE.Mesh>(null!);
  const pulse = useRef<THREE.Mesh>(null!);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((_, dt) => {
    const st = useCore.getState();
    const rm = st.reducedMotion ? 0.2 : 1;
    if (arc.current) {
      arc.current.rotation.y += dt * 0.7 * rm;
      arc.current.rotation.z = 0.35;
    }
    if (pulse.current && pulseMat.current) {
      const t = (performance.now() / 1000) % 2.4;
      const k = t / 2.4;
      const s = 0.3 + k * 2.4;
      pulse.current.scale.setScalar(s);
      pulseMat.current.opacity = 0.5 * (1 - k);
      pulse.current.rotation.z = 0.35;
    }
  });
  return (
    <group>
      <mesh ref={arc}>
        <torusGeometry args={[1.5, 0.012, 8, 120, Math.PI * 1.35]} />
        <meshBasicMaterial color={rim.current} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={pulse}>
        <torusGeometry args={[1, 0.006, 6, 100]} />
        <meshBasicMaterial ref={pulseMat} color={rim.current} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Audio waveform ring (instanced bars) ──────────────────────────────────────
function Waveform({ rim }: { rim: React.MutableRefObject<THREE.Color> }) {
  const count = 72;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const st = useCore.getState();
    const active = st.state === "LISTENING" || st.state === "SPEAKING" || st.state === "THINKING";
    const level = st.audioLevel;
    const t = performance.now() / 1000;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const target = active ? 0.14 + Math.abs(Math.sin(i * 0.55 + t * 3.4)) * (0.34 + level * 0.9) : 0.05;
      const h = ref.current.userData.heights?.[i] ?? 0.05;
      const next = h + (target - h) * Math.min(1, dt * 8);
      (ref.current.userData.heights ??= [])[i] = next;
      dummy.position.set(Math.cos(ang) * 1.86, Math.sin(ang) * 1.86, 0);
      dummy.scale.set(0.012, next * 2, 0.012);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (matRef.current) matRef.current.color.lerp(rim.current, Math.min(1, dt * 6));
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial ref={matRef} color={rim.current} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

// ── Volumetric glow sprites ───────────────────────────────────────────────────
function Glow({ rim }: { rim: React.MutableRefObject<THREE.Color> }) {
  const inner = useRef<THREE.Sprite>(null!);
  const innerMat = useRef<THREE.SpriteMaterial>(null!);
  useFrame((_, dt) => {
    if (innerMat.current) innerMat.current.color.lerp(rim.current, Math.min(1, dt * 6));
    const st = useCore.getState();
    const pal = STATE_PALETTES[st.state] ?? STATE_PALETTES.IDLE;
    const target = 2.6 + pal.intensity * 0.5 + st.audioLevel * 0.6;
    if (inner.current) {
      const s = inner.current.scale.x + (target - inner.current.scale.x) * Math.min(1, dt * 3);
      inner.current.scale.setScalar(s);
    }
  });
  return (
    <sprite ref={inner} scale={[2.6, 2.6, 1]}>
      <spriteMaterial ref={innerMat} map={glowTexture()} color={rim.current} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  );
}

// ── Main core system ──────────────────────────────────────────────────────────
export function JarvisCore() {
  const group = useRef<THREE.Group>(null!);
  const rim = useRef(new THREE.Color(STATE_PALETTES.IDLE.rim));
  const base = useRef(new THREE.Color(STATE_PALETTES.IDLE.base));
  const inner = useRef(new THREE.Color(STATE_PALETTES.IDLE.inner));
  const quality = useCore((s) => s.quality);

  const particleCount = quality === "high" ? 850 : quality === "medium" ? 450 : 200;

  useFrame((_, dt) => {
    if (!group.current) return;
    const st = useCore.getState();
    const pal = STATE_PALETTES[st.state] ?? STATE_PALETTES.IDLE;
    rim.current.lerp(new THREE.Color(pal.rim), Math.min(1, dt * 4.5));
    base.current.lerp(new THREE.Color(pal.base), Math.min(1, dt * 4.5));
    inner.current.lerp(new THREE.Color(pal.inner), Math.min(1, dt * 4.5));

    // Core scale: focus (section-dependent) + state expansion
    const focus = 0.78 + st.coreFocus * 0.22;
    const stateScale = st.state === "LISTENING" ? 1.06 : st.state === "EXECUTING" ? 1.04 : st.state === "ERROR" ? 1.03 : 1;
    const target = focus * stateScale;
    const s = group.current.scale.x + (target - group.current.scale.x) * Math.min(1, dt * 2.5);
    group.current.scale.setScalar(s);
    if (!st.reducedMotion) group.current.rotation.y += dt * 0.06 * pal.speed;
  });

  return (
    <group ref={group}>
      <Glow rim={rim} />
      <EnergySphere rim={rim} base={base} inner={inner} />
      <Ring radius={1.52} tube={0.012} tilt={[0.5, 0.2, 0]} speed={1.2} rim={rim} />
      <Ring radius={1.78} tube={0.008} tilt={[1.15, -0.4, 0.3]} speed={-0.9} rim={rim} />
      <Ring radius={2.02} tube={0.006} tilt={[0.2, 1.25, -0.5]} speed={0.6} rim={rim} />
      <Constellation rim={rim} />
      <Particles rim={rim} count={particleCount} />
      <ScanSystem rim={rim} />
      <Waveform rim={rim} />
    </group>
  );
}
