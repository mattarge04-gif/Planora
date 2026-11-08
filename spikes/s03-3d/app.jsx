// S3 Wegwerf-Messseite: R3F + three BatchedMesh (Elemente) + Points (Pins), 10 Geschosse, N Elemente.
// URL-Parameter: ?n=20000&geschosse=10&modus=batched|instanced&dauer=10000
import React, { useMemo, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const q = new URLSearchParams(location.search);
const N = Number(q.get("n") ?? 20000), GS = Number(q.get("geschosse") ?? 10), MODUS = q.get("modus") ?? "batched", DAUER = Number(q.get("dauer") ?? 10000);
const GB = 60, GT = 30, HOEHE = 3.2, RX = 10, RY = 5; // Gebaeude 60 x 30 m, 50 Raeume/Geschoss
const T0 = performance.now();
let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// ~10 Katalog-Geometrien (Platzhalter fuer GLB, je 100-600 Dreiecke)
function katalog() {
  // Budget 03 Kap. 7.3: <= 2 Mio. Dreiecke bei 20'000 Elementen -> Mittel ~100 Dreiecke (LOD1-Klasse)
  return [
    new THREE.BoxGeometry(0.6, 0.05, 0.6),                 // Panel 12
    new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16),          // Downlight 64
    new THREE.BoxGeometry(1.0, 0.6, 0.1),                  // Heizkoerper 12
    new THREE.BoxGeometry(2.4, 1.25, 1.0, 2, 2, 2),        // Monoblock 48
    new THREE.CylinderGeometry(0.15, 0.15, 0.4, 24),       // VAV 96
    new THREE.SphereGeometry(0.15, 12, 8),                 // Pumpe ~176
    new THREE.BoxGeometry(0.09, 0.09, 0.03),               // Sensor 12
    new THREE.TorusGeometry(0.2, 0.06, 8, 16),             // Ventil 256
    new THREE.CylinderGeometry(0.3, 0.3, 1.5, 24, 2),      // Speicher 144
    new THREE.ConeGeometry(0.2, 0.4, 16),                  // Diverses 48
  ].map((g) => (g.index ? g : g));
}

function gebaeude() {
  const teile = [];
  for (let g = 0; g < GS; g++) {
    const y = g * HOEHE;
    const platte = new THREE.BoxGeometry(GB, 0.2, GT); platte.translate(GB / 2, y, GT / 2); teile.push(platte);
    for (let i = 0; i <= RX; i++) { const w = new THREE.BoxGeometry(0.15, 0.6, GT); w.translate((i * GB) / RX, y + 0.4, GT / 2); teile.push(w); }
    for (let j = 0; j <= RY; j++) { const w = new THREE.BoxGeometry(GB, 0.6, 0.15); w.translate(GB / 2, y + 0.4, (j * GT) / RY); teile.push(w); }
  }
  return mergeGeometries(teile.map((t) => t.toNonIndexed()));
}

const AMPEL = [new THREE.Color("#d9534f"), new THREE.Color("#f0ad4e"), new THREE.Color("#5cb85c")];

function Szene() {
  const { gl, camera, scene, size } = useThree();
  const mess = useRef({ frames: [], letzte: 0, erste: null, start: null });
  const { elemente, pins, haus, dreiecke } = useMemo(() => {
    const geos = katalog(); const mat = new THREE.MeshStandardMaterial({ color: "white", roughness: 0.9 });
    const tri = geos.map((g) => (g.index ? g.index.count : g.attributes.position.count) / 3);
    const m = new THREE.Matrix4(); const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3); let dreiecke = 0;
    let elemente;
    const platz = (i) => { const g = i % GS; const x = rnd() * GB, z = rnd() * GT, y = g * HOEHE + 0.3 + rnd() * 2.2; return [x, y, z]; };
    if (MODUS.startsWith("batched")) {
      let vert = 0, idx = 0; geos.forEach((g) => { vert += g.attributes.position.count; idx += g.index ? g.index.count : 0; });
      const bm = new THREE.BatchedMesh(N, vert, idx, mat); const ids = geos.map((g) => bm.addGeometry(g));
      for (let i = 0; i < N; i++) {
        const t = i % geos.length; const id = bm.addInstance(ids[t]); const [x, y, z] = platz(i);
        m.makeTranslation(x, y, z); bm.setMatrixAt(id, m); const c = AMPEL[Math.floor(rnd() * 3)]; bm.setColorAt(id, c);
        pos.set([x, y + 0.8, z], i * 3); col.set([c.r, c.g, c.b], i * 3); dreiecke += tri[t];
      }
      bm.perObjectFrustumCulled = MODUS !== "batched-roh"; bm.sortObjects = MODUS !== "batched-roh"; elemente = bm;
    } else {
      elemente = new THREE.Group(); const proTyp = Math.ceil(N / geos.length); let i = 0;
      geos.forEach((g, t) => {
        const im = new THREE.InstancedMesh(g, mat, proTyp);
        for (let k = 0; k < proTyp && i < N; k++, i++) { const [x, y, z] = platz(i); m.makeTranslation(x, y, z); im.setMatrixAt(k, m); const c = AMPEL[Math.floor(rnd() * 3)]; im.setColorAt(k, c); pos.set([x, y + 0.8, z], i * 3); col.set([c.r, c.g, c.b], i * 3); dreiecke += tri[t]; }
        elemente.add(im);
      });
    }
    // Pins: ein Points-Objekt (instanzierte Sprites, 1 Draw-Call), Kreis per Shader
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pins = new THREE.Points(pg, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, alphaTest: 0.5, map: kreisTextur() }));
    const haus = new THREE.Mesh(gebaeude(), new THREE.MeshStandardMaterial({ color: "#f4f4f2", roughness: 1 }));
    dreiecke += haus.geometry.attributes.position.count / 3;
    return { elemente, pins, haus, dreiecke };
  }, []);

  useEffect(() => {
    window.__szene = { scene, camera, gl, elemente };
    // Synchron gemessene Frame-Kosten (CPU + GPU): render + readPixels(1px) erzwingt Abschluss der GPU-Arbeit.
    window.__synchron = (n = 200) => {
      const c = gl.getContext(); const px = new Uint8Array(4); const z = [];
      for (let k = 0; k < n; k++) { const w = k * 0.03, r = 120; camera.position.set(GB / 2 + r * Math.cos(w), 90, GT / 2 + r * Math.sin(w)); camera.lookAt(GB / 2, GS * HOEHE / 2, GT / 2);
        const t = performance.now(); gl.render(scene, camera); c.readPixels(0, 0, 1, 1, c.RGBA, c.UNSIGNED_BYTE, px); z.push(performance.now() - t); }
      z.sort((a, b) => a - b); return { median_ms: z[Math.floor(n / 2)], p95_ms: z[Math.floor(n * 0.95)], max_ms: z[n - 1] };
    };
    window.__picking = (n = 50) => { // Raycast an n zufaelligen Bildschirmpunkten
      const rc = new THREE.Raycaster(); const z = [];
      for (let k = 0; k < n; k++) { const p = new THREE.Vector2(rnd() * 2 - 1, rnd() * 2 - 1); const t = performance.now(); rc.setFromCamera(p, camera); rc.intersectObject(elemente, true); z.push(performance.now() - t); }
      z.sort((a, b) => a - b); return { median_ms: z[Math.floor(n / 2)], p95_ms: z[Math.floor(n * 0.95)], max_ms: z[n - 1] };
    };
  }, []);

  useFrame((state, delta) => {
    const t = performance.now(); const s = mess.current;
    if (s.erste === null) { s.erste = t; /* ab Navigationsbeginn */ s.start = t; }
    else if (t - s.start < DAUER) s.frames.push(t - s.letzte);
    else if (!window.__ergebnis) {
      const f = [...s.frames].sort((a, b) => a - b); const info = gl.info.render;
      window.__ergebnis = { n: N, geschosse: GS, modus: MODUS, frames: f.length, fps_median: 1000 / f[Math.floor(f.length / 2)], fps_mittel: (f.length * 1000) / DAUER, frame_p95_ms: f[Math.floor(f.length * 0.95)], frame_max_ms: f[f.length - 1], erste_darstellung_ms: s.erste, draw_calls: info.calls, dreiecke_gerendert: info.triangles, dreiecke_szene: dreiecke, gpu_speicher_geometrien: gl.info.memory.geometries, renderer: gpuName(gl) };
    }
    s.letzte = t;
    const w = (t / 1000) * 0.3; const r = 120; camera.position.set(GB / 2 + r * Math.cos(w), 90, GT / 2 + r * Math.sin(w)); camera.lookAt(GB / 2, GS * HOEHE / 2, GT / 2);
  });

  return (<>
    <ambientLight intensity={0.6} /><directionalLight position={[50, 100, 30]} intensity={1.2} />
    <primitive object={haus} /><primitive object={elemente} /><primitive object={pins} />
  </>);
}

function kreisTextur() { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.arc(16, 16, 14, 0, Math.PI * 2); x.fill(); return new THREE.CanvasTexture(c); }
function gpuName(gl) { const c = gl.getContext(); const e = c.getExtension("WEBGL_debug_renderer_info"); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER); }

createRoot(document.getElementById("root")).render(
  <Canvas orthographic camera={{ zoom: 9, position: [150, 90, 150], near: 0.1, far: 2000 }} gl={{ antialias: true, powerPreference: "high-performance" }} dpr={1} style={{ background: "#e9ecef" }}>
    <Szene />
  </Canvas>
);
