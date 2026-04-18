import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const EXTRUDE_DEPTH = 18;
const BEVEL_THICKNESS = 3;
const BEVEL_SIZE = 3;
const BEVEL_SEGMENTS = 3;
const PIXEL_SIZE = 6;

const ORBIT_RADIUS = 80;
const ORBIT_SPEEDS = [0.3, -0.22, 0.17];
const SPIN_SPEEDS = [0.8, -0.6, 0.5];
const ORBIT_TILTS = [0.3, -0.2, 0.15];
const ORBIT_START_ANGLES = [0, 2.1, 4.2];
const VERTICAL_OFFSETS = [10, -15, 5];
const BUOYANCY_SPEEDS = [0.72, 0.54, 0.64];
const BUOYANCY_AMPLITUDES = [20, 16, 18];
const BUOYANCY_PHASES = [0, 1.8, 3.4];
const BUOYANCY_DEPTHS = [6, 8, 5];
const CAMERA_POSITION = [-33.28, -33.05, 149.32];
const CAMERA_TARGET = [0, 0, 0];

const TUNING_DEFAULTS = {
  inkLow: 0.2,
  inkHigh: 1.0,
  exposure: 2.5,
  inkGray: 0.667,
  pixelSize: PIXEL_SIZE,
  materialGray: 0.79,
  metalness: 0.28,
  roughness: 0.21,
  keyLight: 2.62
};

const CLEANUP_KEY = '__ikeaCardSceneCleanup';

function resetSceneContainer(container) {
  if (typeof container[CLEANUP_KEY] === 'function') {
    container[CLEANUP_KEY]();
  }

  container.querySelectorAll('canvas').forEach((existingCanvas) => {
    const gl =
      existingCanvas.getContext('webgl2') ||
      existingCanvas.getContext('webgl') ||
      existingCanvas.getContext('experimental-webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    existingCanvas.remove();
  });
}

export function initIkeaCardScene() {
  const container = document.querySelector('[data-ikea-canvas]');
  if (!container) return;

  resetSceneContainer(container);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  container.appendChild(canvas);

  const base = (container.dataset.base || '').replace(/\/$/, '');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(...CAMERA_TARGET);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, TUNING_DEFAULTS.keyLight);
  dirLight.position.set(100, 200, 150);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x88cccc, 0.5);
  fillLight.position.set(-100, -50, 100);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
  rimLight.position.set(0, -100, -100);
  scene.add(rimLight);

  // CGA post-processing
  const cgaRT = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false
  });
  const cgaScene = new THREE.Scene();
  const cgaCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  cgaCam.position.z = 1;

  const cgaMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tDiffuse: { value: cgaRT.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPixelSize: { value: TUNING_DEFAULTS.pixelSize },
      uInkLow: { value: TUNING_DEFAULTS.inkLow },
      uInkHigh: { value: TUNING_DEFAULTS.inkHigh },
      uExposure: { value: TUNING_DEFAULTS.exposure },
      uInkGray: { value: TUNING_DEFAULTS.inkGray }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uPixelSize;
      uniform float uInkLow;
      uniform float uInkHigh;
      uniform float uExposure;
      uniform float uInkGray;
      varying vec2 vUv;

      const vec3 PAPER_WHITE = vec3(1.0);

      float bayer4(vec2 cell) {
        vec2 p = mod(cell, 4.0);
        float x = p.x, y = p.y;
        if (y < 1.0) {
          if (x < 1.0) return 0.0/16.0;
          if (x < 2.0) return 8.0/16.0;
          if (x < 3.0) return 2.0/16.0;
          return 10.0/16.0;
        }
        if (y < 2.0) {
          if (x < 1.0) return 12.0/16.0;
          if (x < 2.0) return 4.0/16.0;
          if (x < 3.0) return 14.0/16.0;
          return 6.0/16.0;
        }
        if (y < 3.0) {
          if (x < 1.0) return 3.0/16.0;
          if (x < 2.0) return 11.0/16.0;
          if (x < 3.0) return 1.0/16.0;
          return 9.0/16.0;
        }
        if (x < 1.0) return 15.0/16.0;
        if (x < 2.0) return 7.0/16.0;
        if (x < 3.0) return 13.0/16.0;
        return 5.0/16.0;
      }

      void main() {
        vec2 cell = floor(gl_FragCoord.xy / uPixelSize);
        vec2 snapped = (cell + 0.5) * uPixelSize;
        vec2 sampleUv = snapped / uResolution;
        vec3 col = texture2D(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb * uExposure;
        float threshold = bayer4(cell);

        float luma = dot(clamp(col, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
        if (luma > 0.995) {
          gl_FragColor = vec4(PAPER_WHITE, 1.0);
          return;
        }

        float inkCoverage = 1.0 - smoothstep(uInkLow, uInkHigh, luma);
        gl_FragColor = vec4(inkCoverage > threshold ? vec3(uInkGray) : PAPER_WHITE, 1.0);
      }
    `
  });
  cgaMat.toneMapped = false;
  cgaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cgaMat));

  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    const pw = Math.max(1, Math.floor(w * pr));
    const ph = Math.max(1, Math.floor(h * pr));
    cgaRT.setSize(pw, ph);
    cgaMat.uniforms.uResolution.value.set(pw, ph);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const svgPaths = [
    `${base}/img/ikea_obj_1.svg`,
    `${base}/img/ikea_obj_2.svg`,
    `${base}/img/ikea_obj_3.svg`
  ];

  const orbitPivots = [];
  const meshGroups = [];
  const loader = new SVGLoader();

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setScalar(TUNING_DEFAULTS.materialGray),
    metalness: TUNING_DEFAULTS.metalness,
    roughness: TUNING_DEFAULTS.roughness,
    side: THREE.DoubleSide
  });

  Promise.all(svgPaths.map((url) => fetch(url).then((r) => r.text()))).then(
    (svgTexts) => {
      svgTexts.forEach((svgText, i) => {
        const data = loader.parse(svgText);
        const group = new THREE.Group();

        data.paths.forEach((path) => {
          const shapes = SVGLoader.createShapes(path);
          shapes.forEach((shape) => {
            const geo = new THREE.ExtrudeGeometry(shape, {
              depth: EXTRUDE_DEPTH,
              bevelEnabled: true,
              bevelThickness: BEVEL_THICKNESS,
              bevelSize: BEVEL_SIZE,
              bevelSegments: BEVEL_SEGMENTS
            });
            const mesh = new THREE.Mesh(geo, material.clone());
            group.add(mesh);
          });
        });

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 80;
        const s = targetSize / maxDim;

        group.children.forEach((child) => {
          child.geometry.translate(-center.x, -center.y, -center.z);
        });
        group.scale.set(s, -s, s);

        const pivot = new THREE.Group();
        group.position.set(ORBIT_RADIUS, VERTICAL_OFFSETS[i], 0);
        pivot.rotation.x = ORBIT_TILTS[i];
        pivot.rotation.y = ORBIT_START_ANGLES[i];
        pivot.add(group);
        scene.add(pivot);

        orbitPivots.push(pivot);
        meshGroups.push(group);
      });
    }
  );

  let animationFrame = 0;

  function animate() {
    animationFrame = requestAnimationFrame(animate);
    const t = performance.now() * 0.001;

    orbitPivots.forEach((pivot, i) => {
      pivot.rotation.y = ORBIT_START_ANGLES[i] + t * ORBIT_SPEEDS[i];
    });
    meshGroups.forEach((group, i) => {
      const phase = t * BUOYANCY_SPEEDS[i] + BUOYANCY_PHASES[i];
      const yOffset = Math.sin(phase) * BUOYANCY_AMPLITUDES[i];

      group.position.y = VERTICAL_OFFSETS[i] + yOffset;
      group.position.z = Math.cos(phase * 0.7) * BUOYANCY_DEPTHS[i];
      group.rotation.y = t * SPIN_SPEEDS[i];
      group.rotation.x = Math.sin(t * 0.3 + i * 2) * 0.15;
    });

    renderer.setRenderTarget(cgaRT);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(cgaScene, cgaCam);
  }

  container[CLEANUP_KEY] = () => {
    cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    cgaRT.dispose();
    cgaMat.dispose();
    renderer.dispose();
    canvas.remove();
    container[CLEANUP_KEY] = null;
  };

  animate();
}
