import * as THREE from 'three';

const PIXEL_SIZE = 6;
const DESKTOP_TEXTURE_ZOOM = 2.82;
const MOBILE_TEXTURE_ZOOM = 2.24;
const MOBILE_QUERY = '(max-width: 600px)';
const SAMPLE_INTERVAL = 2500;
const FADE_DURATION = 360;
const BRIGHTNESS = 1.53;
const CLEANUP_KEY = '__mapillaryCardSceneCleanup';

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

function getDefaultTextureZoom() {
  return window.matchMedia(MOBILE_QUERY).matches
    ? MOBILE_TEXTURE_ZOOM
    : DESKTOP_TEXTURE_ZOOM;
}

function randomCenter(viewSize) {
  return new THREE.Vector2(
    viewSize.x / 2 + Math.random() * (1 - viewSize.x),
    viewSize.y / 2 + Math.random() * (1 - viewSize.y)
  );
}

export function initMapillaryCardScene() {
  const container = document.querySelector('[data-mapillary-canvas]');
  if (!container) return;

  resetSceneContainer(container);

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const base = (container.dataset.base || '').replace(/\/$/, '');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 1;

  const imageAspect = { value: 1 };
  const cardAspect = { value: 1 };
  const mobileZoomQuery = window.matchMedia(MOBILE_QUERY);
  let textureZoom = getDefaultTextureZoom();
  const viewSize = new THREE.Vector2(1 / textureZoom, 1 / textureZoom);
  const sampleCenter = new THREE.Vector2(0.5, 0.5);
  let nextCenter = sampleCenter.clone();
  let transitionStart = -Infinity;
  let hasSwapped = true;

  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tMap: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPixelSize: { value: PIXEL_SIZE },
      uCenter: { value: sampleCenter },
      uViewSize: { value: viewSize },
      uWhiteFade: { value: 0 },
      uBrightness: { value: BRIGHTNESS }
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

      uniform sampler2D tMap;
      uniform vec2 uResolution;
      uniform float uPixelSize;
      uniform vec2 uCenter;
      uniform vec2 uViewSize;
      uniform float uWhiteFade;
      uniform float uBrightness;
      varying vec2 vUv;

      const vec3 PAPER_WHITE = vec3(1.0);
      const vec3 CGA_GRAY = vec3(0.667);

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
        vec2 pixelUv = snapped / uResolution;
        vec2 sampleUv = uCenter + (pixelUv - 0.5) * uViewSize;
        vec3 col = texture2D(tMap, clamp(sampleUv, 0.0, 1.0)).rgb * uBrightness;

        float threshold = bayer4(cell);
        float luma = dot(clamp(col, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
        float inkCoverage = 1.0 - smoothstep(0.2, 1.0, luma);

        gl_FragColor = vec4(inkCoverage > threshold + uWhiteFade ? CGA_GRAY : PAPER_WHITE, 1.0);
      }
    `
  });
  material.toneMapped = false;
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  function updateViewSize() {
    viewSize.set(
      cardAspect.value / (imageAspect.value * textureZoom),
      1 / textureZoom
    );
    viewSize.x = Math.min(viewSize.x, 1);
    viewSize.y = Math.min(viewSize.y, 1);
    material.uniforms.uViewSize.value.copy(viewSize);
  }

  function clampSampleCenter() {
    sampleCenter.set(
      THREE.MathUtils.clamp(sampleCenter.x, viewSize.x / 2, 1 - viewSize.x / 2),
      THREE.MathUtils.clamp(sampleCenter.y, viewSize.y / 2, 1 - viewSize.y / 2)
    );
    material.uniforms.uCenter.value.copy(sampleCenter);
  }

  function setTextureZoom(value) {
    textureZoom = THREE.MathUtils.clamp(value, 1.05, 6);
    updateViewSize();
    clampSampleCenter();
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));

    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    material.uniforms.uResolution.value.set(
      Math.max(1, Math.floor(w * pr)),
      Math.max(1, Math.floor(h * pr))
    );

    cardAspect.value = w / h;
    updateViewSize();
    clampSampleCenter();
  }

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  function handleMobileZoomChange(event) {
    setTextureZoom(event.matches ? MOBILE_TEXTURE_ZOOM : DESKTOP_TEXTURE_ZOOM);
  }
  mobileZoomQuery.addEventListener('change', handleMobileZoomChange);

  function beginTransition() {
    nextCenter = randomCenter(viewSize);
    transitionStart = performance.now();
    hasSwapped = false;
  }

  let animationFrame = 0;
  let transitionTimer = 0;
  let loadedTexture = null;

  function animate() {
    animationFrame = requestAnimationFrame(animate);

    const elapsed = performance.now() - transitionStart;
    if (elapsed < FADE_DURATION * 2) {
      if (elapsed < FADE_DURATION) {
        material.uniforms.uWhiteFade.value = elapsed / FADE_DURATION;
      } else {
        if (!hasSwapped) {
          sampleCenter.copy(nextCenter);
          material.uniforms.uCenter.value.copy(sampleCenter);
          hasSwapped = true;
        }
        material.uniforms.uWhiteFade.value = 1 - (elapsed - FADE_DURATION) / FADE_DURATION;
      }
    } else {
      material.uniforms.uWhiteFade.value = 0;
    }

    renderer.render(scene, camera);
  }

  new THREE.TextureLoader().load(`${base}/img/mapillary.png`, (texture) => {
    loadedTexture = texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    imageAspect.value = texture.image.width / texture.image.height;
    updateViewSize();
    sampleCenter.copy(randomCenter(viewSize));
    clampSampleCenter();
    material.uniforms.uCenter.value.copy(sampleCenter);
    material.uniforms.tMap.value = texture;

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      transitionTimer = window.setInterval(beginTransition, SAMPLE_INTERVAL);
    }
  });

  container[CLEANUP_KEY] = () => {
    cancelAnimationFrame(animationFrame);
    window.clearInterval(transitionTimer);
    resizeObserver.disconnect();
    mobileZoomQuery.removeEventListener('change', handleMobileZoomChange);
    loadedTexture?.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
    container[CLEANUP_KEY] = null;
  };

  animate();
}
