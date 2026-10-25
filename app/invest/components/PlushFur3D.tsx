"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const SHELLS = 32;
const FUR_LENGTH = 0.22;

/* Shell texturing fragment shader.
   Each shell shows only the fragments where a per-pixel noise exceeds the
   shell's layer fraction, producing the appearance of individual fibers. */
const furFragment = /* glsl */ `
  uniform vec3 uRootColor;
  uniform vec3 uTipColor;
  uniform float uLayerFraction;
  uniform float uDensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    float noise = hash(vUv * uDensity);
    if (noise < uLayerFraction && uLayerFraction > 0.0) discard;
    vec3 color = mix(uRootColor, uTipColor, uLayerFraction);
    color += 0.08 * uLayerFraction;
    float alpha = 1.0 - smoothstep(0.78, 1.0, uLayerFraction) * 0.5;
    gl_FragColor = vec4(color, alpha);
  }
`;

const furVertex = /* glsl */ `
  uniform float uLayerFraction;
  uniform float uFurLength;
  uniform float uTime;
  uniform vec2 uMouse;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position + normal * (uLayerFraction * uFurLength);

    float wave = sin(uTime * 1.4 + pos.y * 4.0) * 0.015 * uLayerFraction;
    pos.x += wave + uMouse.x * uLayerFraction * 0.1;
    pos.y += uMouse.y * uLayerFraction * 0.1;
    pos.z += sin(uTime * 1.1 + pos.x * 2.4) * 0.012 * uLayerFraction;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

function FurBall() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef<[number, number]>([0, 0]);

  const geometry = useMemo(() => new THREE.SphereGeometry(0.95, 72, 72), []);

  // One material per shell, each with its own layerFraction uniform.
  const materials = useMemo(() => {
    const mats: THREE.ShaderMaterial[] = [];
    for (let i = 0; i < SHELLS; i++) {
      const layer = i / (SHELLS - 1);
      mats.push(
        new THREE.ShaderMaterial({
          uniforms: {
            uRootColor: { value: new THREE.Color("#6b123e") },
            uTipColor: { value: new THREE.Color("#ffdbea") },
            uLayerFraction: { value: layer },
            uFurLength: { value: FUR_LENGTH },
            uDensity: { value: 260 },
            uTime: { value: 0 },
            uMouse: { value: new THREE.Vector2(0, 0) }
          },
          vertexShader: furVertex,
          fragmentShader: furFragment,
          transparent: true,
          depthWrite: i === 0,
          side: THREE.DoubleSide
        })
      );
    }
    return mats;
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.25;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.08;

    const target = state.pointer;
    mouseRef.current[0] += (target.x - mouseRef.current[0]) * 0.08;
    mouseRef.current[1] += (target.y - mouseRef.current[1]) * 0.08;

    const t = state.clock.elapsedTime;
    for (const m of materials) {
      m.uniforms.uTime.value = t;
      m.uniforms.uMouse.value.set(mouseRef.current[0], mouseRef.current[1]);
    }
  });

  return (
    <group ref={groupRef}>
      {materials.map((mat, i) => (
        <mesh key={i} geometry={geometry} material={mat} renderOrder={i} />
      ))}
    </group>
  );
}

export default function PlushFur3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.6], fov: 48 }}
      gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
      dpr={[1, 2]}
      style={{ background: "transparent" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 3, 2]} intensity={1.2} />
      <FurBall />
    </Canvas>
  );
}
