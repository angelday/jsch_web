import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

const CLEANUP_KEY = '__brandHeroSceneCleanup';
const EXTRUDE_DEPTH = 5;
const BEVEL_THICKNESS = 0.65;
const BEVEL_SIZE = 0.65;
const BEVEL_SEGMENTS = 3;
const PIXEL_SIZE = 6;
const TARGET_SIZE = 186;

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

function disposeObject3d(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function resolveAssetUrl(path, base) {
  const trimmedPath = path?.trim();
  if (!trimmedPath) return '';
  if (/^(?:https?:)?\/\//.test(trimmedPath) || trimmedPath.startsWith('/')) {
    return trimmedPath;
  }
  return `${base}/${trimmedPath.replace(/^\/+/, '')}`;
}

export function initBrandHeroScene() {
  const container = document.querySelector('[data-brand-hero-canvas]');
  if (!container) return;

  resetSceneContainer(container);

  const base = (container.dataset.base || '').replace(/\/$/, '');
  const brandSvg = resolveAssetUrl(container.dataset.brandSvg, base);
  if (!brandSvg) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000);
  camera.position.set(0, 0, 380);

  scene.add(new THREE.AmbientLight(0xffffff, 0.74));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.9);
  keyLight.position.set(-80, 110, 180);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.72);
  rimLight.position.set(120, -80, 120);
  scene.add(rimLight);

  const logoGroup = new THREE.Group();
  logoGroup.rotation.y = -0.34;
  scene.add(logoGroup);

  const cgaRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false
  });
  const cgaScene = new THREE.Scene();
  const cgaCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  cgaCamera.position.z = 1;
  const cgaMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {
      tDiffuse: { value: cgaRenderTarget.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPixelSize: { value: PIXEL_SIZE }
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
      varying vec2 vUv;

      float bayer4(vec2 cell) {
        vec2 p = mod(cell, 4.0);
        float x = p.x;
        float y = p.y;

        if (y < 1.0) {
          if (x < 1.0) return 0.0 / 16.0;
          if (x < 2.0) return 8.0 / 16.0;
          if (x < 3.0) return 2.0 / 16.0;
          return 10.0 / 16.0;
        }

        if (y < 2.0) {
          if (x < 1.0) return 12.0 / 16.0;
          if (x < 2.0) return 4.0 / 16.0;
          if (x < 3.0) return 14.0 / 16.0;
          return 6.0 / 16.0;
        }

        if (y < 3.0) {
          if (x < 1.0) return 3.0 / 16.0;
          if (x < 2.0) return 11.0 / 16.0;
          if (x < 3.0) return 1.0 / 16.0;
          return 9.0 / 16.0;
        }

        if (x < 1.0) return 15.0 / 16.0;
        if (x < 2.0) return 7.0 / 16.0;
        if (x < 3.0) return 13.0 / 16.0;
        return 5.0 / 16.0;
      }

      void main() {
        vec2 cell = floor(gl_FragCoord.xy / uPixelSize);
        vec2 snapped = (cell + 0.5) * uPixelSize;
        vec4 sampleColor = texture2D(tDiffuse, clamp(snapped / uResolution, 0.0, 1.0));
        float luma = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
        float coverage = clamp(sampleColor.a * luma * 1.35, 0.0, 1.0);
        float threshold = bayer4(cell);

        gl_FragColor = coverage > threshold ? vec4(vec3(1.0), 1.0) : vec4(0.0);
      }
    `
  });
  cgaMaterial.toneMapped = false;
  cgaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cgaMaterial));

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.08,
    roughness: 0.34,
    side: THREE.DoubleSide
  });

  let disposed = false;
  let animationFrame = 0;

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    renderer.setSize(width, height, false);
    const pixelRatio = renderer.getPixelRatio();
    const renderWidth = Math.max(1, Math.floor(width * pixelRatio));
    const renderHeight = Math.max(1, Math.floor(height * pixelRatio));
    cgaRenderTarget.setSize(renderWidth, renderHeight);
    cgaMaterial.uniforms.uResolution.value.set(renderWidth, renderHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  fetch(brandSvg)
    .then((response) => response.text())
    .then((svgText) => {
      if (disposed) return;

      const loader = new SVGLoader();
      const data = loader.parse(svgText);

      data.paths.forEach((path) => {
        SVGLoader.createShapes(path).forEach((shape) => {
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: EXTRUDE_DEPTH,
            bevelEnabled: true,
            bevelThickness: BEVEL_THICKNESS,
            bevelSize: BEVEL_SIZE,
            bevelSegments: BEVEL_SEGMENTS
          });

          const mesh = new THREE.Mesh(geometry, material.clone());
          logoGroup.add(mesh);
        });
      });

      const box = new THREE.Box3().setFromObject(logoGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = TARGET_SIZE / Math.max(1, maxDim);

      logoGroup.children.forEach((child) => {
        child.geometry.translate(-center.x, -center.y, -center.z);
      });
      logoGroup.scale.set(scale, -scale, scale);
    });

  function animate() {
    animationFrame = requestAnimationFrame(animate);
    logoGroup.rotation.y = -0.34 + performance.now() * 0.00042;
    renderer.setRenderTarget(cgaRenderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(cgaScene, cgaCamera);
  }

  container[CLEANUP_KEY] = () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    disposeObject3d(scene);
    disposeObject3d(cgaScene);
    cgaRenderTarget.dispose();
    cgaMaterial.dispose();
    renderer.dispose();
    canvas.remove();
    container[CLEANUP_KEY] = null;
  };

  animate();
}
