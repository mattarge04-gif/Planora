// S3b Wegwerf-Messseite: "einfacher Look" wie Referenzbilder (isometrisch, Glas-Geschosse,
// Raeume als Linien, Elemente als Pins, Geschoss-Beschriftung, graue Umgebungsbloecke).
// Keine Bauteil-Modelle. URL: ?n=2000&geschosse=10&dpr=1&schatten=0
import React, { useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const q = new URLSearchParams(location.search);
const N = Number(q.get("n") ?? 2000), GS = Number(q.get("geschosse") ?? 10), DPR = Number(q.get("dpr") ?? 1);
const AA = q.get("aa") !== "0", GLAS = q.get("glas") !== "0"; // Stellschrauben fuer schwache Geraete
const GB = 60, GT = 30, H = 3.2, RX = 10, RY = 5;
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const AMPEL = ["#d9534f", "#f0ad4e", "#5cb85c"].map((c) => new THREE.Color(c));

function bauen() {
  const g = new THREE.Group();
  // Boden + Umgebung: 40 graue Bloecke als EINE Geometrie
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: "#d9dbde" }));
  boden.rotation.x = -Math.PI / 2; boden.position.set(GB / 2, -0.05, GT / 2); g.add(boden);
  const bl = [];
  for (let i = 0; i < 40; i++) { const w = 15 + rnd() * 25, d = 15 + rnd() * 25, h = 4 + rnd() * 18; const b = new THREE.BoxGeometry(w, h, d);
    let x, z; do { x = GB / 2 + (rnd() - 0.5) * 360; z = GT / 2 + (rnd() - 0.5) * 360; } while (Math.abs(x - GB / 2) < 60 && Math.abs(z - GT / 2) < 45);
    b.translate(x, h / 2, z); bl.push(b.toNonIndexed()); }
  g.add(new THREE.Mesh(mergeGeometries(bl), new THREE.MeshLambertMaterial({ color: "#eef0f2" })));
  // Glas-Geschossplatten: eine transparente Geometrie
  const pl = []; for (let s = 0; s < GS; s++) { const p = new THREE.BoxGeometry(GB, 0.15, GT); p.translate(GB / 2, s * H, GT / 2); pl.push(p.toNonIndexed()); }
  g.add(new THREE.Mesh(mergeGeometries(pl), new THREE.MeshLambertMaterial({ color: "#cfe3f2", transparent: true, opacity: 0.35, depthWrite: false })));
  // Fassade als Glaskasten + Kanten
  const kasten = new THREE.BoxGeometry(GB, GS * H, GT); kasten.translate(GB / 2, (GS * H) / 2 - 0.1, GT / 2);
  if (GLAS) g.add(new THREE.Mesh(kasten, new THREE.MeshLambertMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, depthWrite: false })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(kasten), new THREE.LineBasicMaterial({ color: "#8a99a8" })));
  // Raumgrenzen aller Geschosse als EINE LineSegments
  const v = [];
  for (let s = 0; s < GS; s++) { const y = s * H + 0.1;
    for (let i = 0; i <= RX; i++) { const x = (i * GB) / RX; v.push(x, y, 0, x, y, GT); }
    for (let j = 0; j <= RY; j++) { const z = (j * GT) / RY; v.push(0, y, z, GB, y, z); } }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: "#9fb0c0", transparent: true, opacity: 0.6 })));
  // Elemente als Pins (1 Draw-Call)
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const s = i % GS; pos.set([rnd() * GB, s * H + 0.6, rnd() * GT], i * 3); const c = AMPEL[Math.floor(rnd() * 3)]; col.set([c.r, c.g, c.b], i * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pins = new THREE.Points(pg, new THREE.PointsMaterial({ size: 8, sizeAttenuation: false, vertexColors: true, alphaTest: 0.5, map: kreis() }));
  g.add(pins);
  // Geschoss-Beschriftungen (Sprites mit Canvas-Text), wie "F7 27.0 kWh"
  for (let s = 0; s < GS; s++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: text(`OG ${s}  ·  ${Math.floor(rnd() * 40)} Elemente`), depthTest: false }));
    sp.scale.set(14, 3.5, 1); sp.position.set(-9, s * H + 1, GT / 2); g.add(sp); }
  return { g, pins };
}

function kreis() { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.arc(16, 16, 14, 0, 7); x.fill(); return new THREE.CanvasTexture(c); }
function text(t) { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "rgba(255,255,255,.9)"; x.fillRect(0, 8, 256, 48); x.fillStyle = "#223"; x.font = "bold 26px sans-serif"; x.fillText(t, 10, 42); return new THREE.CanvasTexture(c); }
function gpuName(gl) { const c = gl.getContext(); const e = c.getExtension("WEBGL_debug_renderer_info"); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER); }

function Szene() {
  const { gl, camera, scene, invalidate } = useThree();
  const { g, pins } = useMemo(bauen, []);
  useEffect(() => {
    const T = performance.now();
    window.__synchron = (n = 60) => {
      const c = gl.getContext(); const px = new Uint8Array(4); const z = [];
      for (let k = 0; k < n; k++) { const w = 0.6 + k * 0.03, r = 140; camera.position.set(GB / 2 + r * Math.cos(w), 100, GT / 2 + r * Math.sin(w)); camera.lookAt(GB / 2, GS * H / 2, GT / 2);
        const t = performance.now(); gl.render(scene, camera); c.readPixels(0, 0, 1, 1, c.RGBA, c.UNSIGNED_BYTE, px); z.push(performance.now() - t); }
      z.sort((a, b) => a - b); const i = gl.info.render;
      return { median_ms: z[Math.floor(n / 2)], p95_ms: z[Math.floor(n * 0.95)], draw_calls: i.calls, dreiecke: i.triangles, renderer: gpuName(gl) };
    };
    window.__picking = (n = 50) => { const rc = new THREE.Raycaster(); rc.params.Points.threshold = 0.5; const z = [];
      for (let k = 0; k < n; k++) { const p = new THREE.Vector2(rnd() * 2 - 1, rnd() * 2 - 1); const t = performance.now(); rc.setFromCamera(p, camera); rc.intersectObject(pins); z.push(performance.now() - t); }
      z.sort((a, b) => a - b); return { p95_ms: z[Math.floor(n * 0.95)] }; };
    window.__bereit = performance.now();
  }, []);
  return (<><ambientLight intensity={1.1} /><directionalLight position={[80, 120, 40]} intensity={1.4} /><primitive object={g} /></>);
}

createRoot(document.getElementById("root")).render(
  // frameloop="demand": gezeichnet wird nur bei Aenderung (Kamera, Auswahl) -> im Ruhezustand 0 % GPU
  <Canvas frameloop="demand" orthographic dpr={DPR} camera={{ zoom: 6, position: [180, 100, 180], near: 0.1, far: 3000 }} gl={{ antialias: AA }} style={{ background: "#e9ecef" }}>
    <Szene />
  </Canvas>
);
