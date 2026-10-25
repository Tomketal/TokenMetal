"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/* Full-viewport animated pink fur background. Uses an orthographic quad
   with a procedural fur shader (worley-ish cells + rim lighting + sway).
   Mounted fixed, behind the UI, pointer-events: none. */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform vec3 uRoot;
  uniform vec3 uTip;
  uniform vec3 uShadow;
  uniform vec3 uHighlight;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Cellular (worley) distance — gives the "clump" look of fur
  float worley(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = vec2(
          hash(i + neighbor),
          hash(i + neighbor + vec2(17.0, 31.0))
        );
        point = 0.5 + 0.5 * sin(uTime * 0.3 + 6.2831 * point);
        vec2 diff = neighbor + point - f;
        float dist = dot(diff, diff);
        minDist = min(minDist, dist);
      }
    }
    return sqrt(minDist);
  }

  void main() {
    // Correct for aspect so cells aren't stretched
    vec2 uv = vUv;
    uv.x *= uRes.x / uRes.y;

    // Mouse-driven subtle lean on fibers
    vec2 mouseOffset = (uMouse - 0.5) * 0.08;

    // Vertical strand bias: scale Y more than X so cells become vertical streaks
    vec2 strandUv = vec2(uv.x * 60.0, uv.y * 180.0);
    strandUv += mouseOffset * vec2(2.0, 6.0);

    // Fine fiber density via worley cells + displacement over time
    float cellA = worley(strandUv + vec2(uTime * 0.08, 0.0));
    float cellB = worley(strandUv * 1.7 + vec2(-uTime * 0.05, uTime * 0.03));

    // Combine two cell scales so some strands dominate over others (natural clumping)
    float fibers = mix(cellA, cellB, 0.45);

    // Sharp strand look: contrast + threshold
    float strand = smoothstep(0.0, 0.35, fibers);

    // Root-to-tip color based on strand brightness (bright strand tips)
    vec3 color = mix(uRoot, uTip, strand);

    // Add a brighter highlight band from the "top" of each strand
    float highlight = pow(1.0 - cellA, 3.0);
    color = mix(color, uHighlight, highlight * 0.45);

    // Add a soft shadow in the recesses between clumps
    float shadow = smoothstep(0.0, 0.08, fibers);
    color = mix(uShadow, color, shadow);

    // Vignette toward edges so the center feels focal
    vec2 centered = vUv - 0.5;
    float vignette = 1.0 - smoothstep(0.45, 0.95, length(centered));
    color *= 0.72 + 0.28 * vignette;

    // Gentle breath pulse — subtle brightness oscillation
    color *= 0.95 + 0.05 * sin(uTime * 0.6);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function FurPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uRoot: { value: new THREE.Color("#5c0e3a") },
      uTip: { value: new THREE.Color("#ffd8ea") },
      uShadow: { value: new THREE.Color("#3a0824") },
      uHighlight: { value: new THREE.Color("#fff2f7") }
    }),
    []
  );

  useFrame((state, delta) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value += delta;
    m.uniforms.uRes.value.set(state.size.width, state.size.height);
    // smooth mouse tracking (pointer is -1..1, convert to 0..1)
    const px = state.pointer.x * 0.5 + 0.5;
    const py = state.pointer.y * 0.5 + 0.5;
    const cur = m.uniforms.uMouse.value;
    cur.x += (px - cur.x) * 0.06;
    cur.y += (py - cur.y) * 0.06;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function PlushBackground() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1] }}
      gl={{ antialias: true, alpha: false, premultipliedAlpha: false }}
      dpr={[1, 1.5]}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none"
      }}
    >
      <FurPlane />
    </Canvas>
  );
}
