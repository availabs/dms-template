import React from "react";

// HeroAtlas — the landing hero's living backdrop: New York State drawn purely by
// its roads (OSM motorway + trunk, simplified/quantized to /data/ny_roads.json),
// tilted like a survey sheet, with traffic pulses streaming along the interstates.
// Consumed by themev2's `hero_atlas` layoutGroup style via the LayoutGroup
// `Background` key. three.js is dynamic-imported so it never enters the main
// bundle; respects prefers-reduced-motion (single static frame).
export default function HeroAtlas() {
  const mountRef = React.useRef(null);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      const [THREE, res] = await Promise.all([
        import("three"),
        fetch("/data/ny_roads.json"),
      ]);
      if (disposed || !res.ok) return;
      const D = await res.json();
      if (disposed) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const Q = D.q, ASPECT = D.aspect;
      const toWorld = (vx, vy) => [vx / Q * ASPECT, vy / Q];

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 20);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.style.position = "absolute";
      renderer.domElement.style.inset = "0";
      mount.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      // merged line segments per road class; per-chain birth drives the draw-on
      const lineMat = (hex, alpha) => new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uT: { value: reduced ? 1 : 0 }, uColor: { value: new THREE.Color(hex) }, uAlpha: { value: alpha } },
        vertexShader: `attribute float aBirth; varying float vB;
          void main(){ vB = aBirth; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uT; uniform float uAlpha; varying float vB;
          void main(){ float a = uAlpha * smoothstep(vB, vB + 0.22, uT); if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }`,
      });
      const buildLines = (chains, hex, alpha) => {
        const pos = [], birth = [];
        for (const flat of chains) {
          const b = Math.random() * 0.75;
          for (let i = 0; i + 3 < flat.length; i += 2) {
            const [x1, y1] = toWorld(flat[i], flat[i + 1]);
            const [x2, y2] = toWorld(flat[i + 2], flat[i + 3]);
            pos.push(x1, y1, 0, x2, y2, 0); birth.push(b, b);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("aBirth", new THREE.Float32BufferAttribute(birth, 1));
        const m = new THREE.LineSegments(g, lineMat(hex, alpha));
        group.add(m); return m;
      };
      const trunkLines = buildLines(D.trunk, "#8FA3B8", 0.34);
      const mwLines = buildLines(D.motorway, "#1E3A5F", 0.64);

      // traffic pulses along the longer motorway chains
      const chains = D.motorway.map(flat => {
        const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push(toWorld(flat[i], flat[i + 1]));
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        return { pts, cum, len: cum[cum.length - 1] };
      }).filter(c => c.len > 0.02);
      const totalLen = chains.reduce((s, c) => s + c.len, 0);

      const N = 460;
      const parts = [];
      for (let i = 0; i < N; i++) {
        let r = Math.random() * totalLen, ci = 0;
        while (ci < chains.length - 1 && r > chains[ci].len) { r -= chains[ci].len; ci++; }
        parts.push({ c: chains[ci], u: Math.random(), v: (0.008 + Math.random() * 0.02) / chains[ci].len * (Math.random() < 0.5 ? 1 : -1) });
      }
      const pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3), pSize = new Float32Array(N);
      const gold = new THREE.Color("#F59E0B"), blue = new THREE.Color("#1F3F8F");
      for (let i = 0; i < N; i++) {
        const isGold = Math.random() < 0.16;
        (isGold ? gold : blue).toArray(pCol, i * 3);
        pSize[i] = isGold ? 4.4 : 2.7;
      }
      const sample = (c, u) => {
        const target = u * c.len; let lo = 0, hi = c.cum.length - 1;
        while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (c.cum[mid] < target) lo = mid; else hi = mid; }
        const span = c.cum[hi] - c.cum[lo] || 1e-9, t = (target - c.cum[lo]) / span;
        return [c.pts[lo][0] + (c.pts[hi][0] - c.pts[lo][0]) * t, c.pts[lo][1] + (c.pts[hi][1] - c.pts[lo][1]) * t];
      };
      const pGeom = new THREE.BufferGeometry();
      pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      pGeom.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
      pGeom.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
      const pMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, vertexColors: true,
        uniforms: { uT: { value: reduced ? 1 : 0 }, uPx: { value: renderer.getPixelRatio() } },
        vertexShader: `attribute float aSize; uniform float uPx; varying vec3 vC;
          void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = aSize * uPx; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uT; varying vec3 vC;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d) * 0.95 * smoothstep(0.55, 1.0, uT);
            if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`,
      });
      group.add(new THREE.Points(pGeom, pMat));

      const updateParts = (dt) => {
        for (let i = 0; i < N; i++) {
          const p = parts[i];
          p.u += p.v * dt * 60 * 0.016;
          if (p.u > 1) p.u -= 1; if (p.u < 0) p.u += 1;
          const [x, y] = sample(p.c, p.u);
          pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = 0.001;
        }
        pGeom.attributes.position.needsUpdate = true;
      };

      // frame the state on the right half of the band; slight tilt for depth
      const cx = ASPECT / 2, cy = 0.5, TILT = 0.34;
      const layout = () => {
        const w = mount.clientWidth, h = Math.max(mount.clientHeight, 1);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        // cover fit: the network spans the band edge-to-edge (full lon range,
        // Long Island touching the right edge); the vertical slice favors the
        // dense southern/central corridors and crops the sparse North Country.
        const viewW = ASPECT * 1.03;
        const dist = viewW / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
        const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const cyT = Math.min(0.5, Math.max(0.32, viewH / 2 * 0.92));
        camera.position.set(cx, cyT - dist * Math.sin(TILT), dist * Math.cos(TILT));
        camera.lookAt(cx, cyT, 0);
        camera.updateProjectionMatrix();
        if (reduced) renderer.render(scene, camera);
      };
      layout();
      const ro = new ResizeObserver(layout);
      ro.observe(mount);

      const t0 = performance.now();
      const tick = () => {
        if (disposed) return;
        const t = (performance.now() - t0) / 1000;
        const uT = Math.min(1, t / 2.4);
        mwLines.material.uniforms.uT.value = uT;
        trunkLines.material.uniforms.uT.value = uT;
        pMat.uniforms.uT.value = uT;
        updateParts(1 / 60);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      if (reduced) { updateParts(0); renderer.render(scene, camera); }
      else raf = requestAnimationFrame(tick);

      cleanup = () => {
        ro.disconnect();
        cancelAnimationFrame(raf);
        scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => { disposed = true; cleanup(); };
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(90deg, rgba(252,253,254,0.96) 0%, rgba(252,253,254,0.86) 38%, rgba(252,253,254,0.45) 64%, rgba(252,253,254,0.08) 84%, rgba(252,253,254,0) 100%)" }}
      />
    </div>
  );
}
