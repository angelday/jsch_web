import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const HIGHLIGHT_ASSET = 'models/c20pzu37els9.glb';
const FADE_DURATION = 500;

export function initWorkVisualization() {
  const canvas = document.querySelector('[data-work-canvas]');
  if (!canvas) return;

  const container = canvas.parentElement || canvas;
  const base = (canvas.dataset.vizBase || '').replace(/\/$/, '');
  const SCENE_JSON_URL = `${base}/viz/scene/scene_V3TMF8.json`;
  const SCENE_BASE_URL = `${base}/viz/scene/`;
  const DRACO_DECODER_URL = `${base}/viz/draco/`;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x00ffff);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 2000);
  camera.position.set(-3.080, 0.620, -0.509);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.415, 0.257, -0.262);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.0;
  controls.enabled = false;
  controls.update();

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
    uniforms: {
      tDiffuse: { value: cgaRenderTarget.texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPixelSize: { value: 8 }
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

      const float dim = 1.0;
      const vec3 CGA_BLACK = vec3(0.0, 0.0, 0.0);
      const vec3 CGA_CYAN = dim * vec3(0.0, 0.667, 0.667);
      const vec3 CGA_WHITE = dim * vec3(0.667, 0.667, 0.667);

      vec3 nearestCGA(vec3 col) {
        vec3 best = CGA_BLACK;
        float bestDist = distance(col, CGA_BLACK);

        float d = distance(col, CGA_CYAN);
        if (d < bestDist) {
          bestDist = d;
          best = CGA_CYAN;
        }

        d = distance(col, CGA_WHITE);
        if (d < bestDist) {
          best = CGA_WHITE;
        }

        return best;
      }

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
        vec2 sampleUv = snapped / uResolution;

        vec3 col = texture2D(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;
        float threshold = bayer4(cell);

        float cyanBackdrop = step(col.r, 0.08) * step(0.85, col.g) * step(0.85, col.b);
        if (cyanBackdrop > 0.5) {
          gl_FragColor = vec4(CGA_CYAN, 1.0);
          return;
        }

        float cyanToWhiteFade = step(0.85, col.g) * step(0.85, col.b);
        if (cyanToWhiteFade > 0.5) {
          float coverage = smoothstep(0.02, 0.98, col.r);
          gl_FragColor = vec4(coverage > threshold ? CGA_WHITE : CGA_CYAN, 1.0);
          return;
        }

        float grayRange = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
        if (grayRange < 0.04) {
          float coverage = smoothstep(0.02, 0.98, dot(col, vec3(0.299, 0.587, 0.114)));
          gl_FragColor = vec4(coverage > threshold ? CGA_WHITE : CGA_BLACK, 1.0);
          return;
        }

        float checker = mod(cell.x + cell.y, 2.0);
        col += (checker - 0.5) * 0.35;

        gl_FragColor = vec4(nearestCGA(col), 1.0);
      }
    `
  });
  cgaMaterial.toneMapped = false;
  cgaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cgaMaterial));

  function resizeRenderer() {
    const rect = container.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));

    renderer.setSize(cssW, cssH, false);

    const pixelRatio = renderer.getPixelRatio();
    const width = Math.max(1, Math.floor(cssW * pixelRatio));
    const height = Math.max(1, Math.floor(cssH * pixelRatio));

    cgaRenderTarget.setSize(width, height);
    cgaMaterial.uniforms.uResolution.value.set(width, height);

    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
  }

  resizeRenderer();

  const resizeObserver = new ResizeObserver(() => resizeRenderer());
  resizeObserver.observe(container);

  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_DECODER_URL);
  loader.setDRACOLoader(dracoLoader);

  let loadedRoot = null;
  let revealInterval = null;
  let animationFrame = 0;
  let isRendering = false;
  let isVisible = true;
  const fadingObjects = [];

  function startFadeIn(object) {
    object.visible = true;
    fadingObjects.push({
      object,
      startTime: performance.now(),
      duration: FADE_DURATION
    });
  }

  function renderFrame() {
    const now = performance.now();
    for (let i = fadingObjects.length - 1; i >= 0; i--) {
      const item = fadingObjects[i];
      const elapsed = now - item.startTime;
      const t = Math.min(elapsed / item.duration, 1);

      item.object.traverse((child) => {
        if (child.isMesh) {
          child.material.opacity = t;
        }
      });

      if (t >= 1) {
        fadingObjects.splice(i, 1);
      }
    }

    controls.update();

    renderer.setRenderTarget(cgaRenderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(cgaScene, cgaCamera);
  }

  function tick() {
    if (!isRendering) return;
    renderFrame();
    animationFrame = requestAnimationFrame(tick);
  }

  function startRendering() {
    if (isRendering || document.hidden) return;
    isRendering = true;
    tick();
  }

  function stopRendering() {
    isRendering = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  if ('IntersectionObserver' in window) {
    const renderObserver = new IntersectionObserver(
      (entries) => {
        isVisible = entries.some((entry) => entry.isIntersecting);
        if (isVisible) {
          startRendering();
        } else {
          stopRendering();
        }
      },
      { rootMargin: '200px 0px' }
    );
    renderObserver.observe(container);
  } else {
    startRendering();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRendering();
    } else if (isVisible) {
      startRendering();
    }
  });

  function applyTransform(obj, transform) {
    const p = transform?.position || [0, 0, 0];
    const q = transform?.quaternion || [0, 0, 0, 1];
    const s = transform?.scale || [1, 1, 1];

    obj.position.set(p[0], p[1], p[2]);
    obj.quaternion.set(q[0], q[1], q[2], q[3]);
    obj.scale.set(s[0], s[1], s[2]);
  }

  function applyCgaFurnitureStyle(object, isHighlighted) {
    const color = isHighlighted ? 0x000000 : 0xffffff;

    object.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0
        });
      }
    });
  }

  function sortHeroFirst(nodes) {
    return [...nodes].sort((a, b) => {
      const aIsHero = a?.asset === HIGHLIGHT_ASSET ? -1 : 0;
      const bIsHero = b?.asset === HIGHLIGHT_ASSET ? -1 : 0;
      return aIsHero - bIsHero;
    });
  }

  async function buildNode(node, gltfCache) {
    const obj = new THREE.Group();
    obj.name = node?.name || '';
    applyTransform(obj, node?.transform);
    if (node?.userData) obj.userData = { ...node.userData };

    if (node?.asset) {
      const assetUrl = SCENE_BASE_URL + node.asset;

      let gltfPromise = gltfCache.get(assetUrl);
      if (!gltfPromise) {
        gltfPromise = loader.loadAsync(assetUrl);
        gltfCache.set(assetUrl, gltfPromise);
      }

      const gltf = await gltfPromise;
      const model = gltf.scene.clone();
      applyCgaFurnitureStyle(model, node.asset === HIGHLIGHT_ASSET);

      model.visible = false;
      model.userData.isAnimatable = true;
      model.userData.isHero = node.asset === HIGHLIGHT_ASSET;
      if (node?.userData?.entityId) {
        model.userData.entityId = node.userData.entityId;
      }

      obj.add(model);
    }

    const children = Array.isArray(node?.children) ? node.children : [];
    for (const child of sortHeroFirst(children)) {
      obj.add(await buildNode(child, gltfCache));
    }

    return obj;
  }

  async function rebuildFromSceneJson(sceneJson) {
    if (loadedRoot) {
      scene.remove(loadedRoot);
      loadedRoot = null;
    }
    if (revealInterval) {
      clearInterval(revealInterval);
      revealInterval = null;
    }

    const gltfCache = new Map();

    const nodes = Array.isArray(sceneJson?.nodes) ? sceneJson.nodes : [];
    const rootNode = nodes[0];
    if (!rootNode) throw new Error('No root node in scene.json');

    loadedRoot = await buildNode(rootNode, gltfCache);
    scene.add(loadedRoot);

    const itemsToReveal = [];
    loadedRoot.traverse((child) => {
      if (child.userData.isAnimatable) {
        itemsToReveal.push(child);
      }
    });
    itemsToReveal.sort((a, b) => (b.userData.isHero ? 1 : 0) - (a.userData.isHero ? 1 : 0));

    let index = 0;
    revealInterval = setInterval(() => {
      if (index >= itemsToReveal.length) {
        clearInterval(revealInterval);
        revealInterval = null;
        return;
      }
      startFadeIn(itemsToReveal[index]);
      index++;
    }, 250);
  }

  (async function load() {
    try {
      const resp = await fetch(SCENE_JSON_URL);
      if (!resp.ok) throw new Error(`Failed to load scene (${resp.status})`);
      const sceneJson = await resp.json();
      await rebuildFromSceneJson(sceneJson);
    } catch (e) {
      console.error('[work-visualization]', e);
    }
  })();
}
