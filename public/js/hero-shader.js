const vertexShaderSource = `
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform float uResolution;
uniform float uSpeed;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uUseWhite;

const int depth = 4;

// CGA palette 1 low intensity — dim controls output brightness
const float dim = 1.0;
const vec3 CGA_BLACK   = vec3(0.0, 0.0, 0.0);
const vec3 CGA_CYAN    = dim * vec3(0.0, 0.667, 0.667);
const vec3 CGA_MAGENTA = dim * vec3(0.667, 0.0, 0.667);
const vec3 CGA_WHITE   = dim * vec3(0.667, 0.667, 0.667);

vec3 nearestCGA(vec3 col) {
  vec3 best = CGA_BLACK;
  float bestDist = distance(col, CGA_BLACK);

  float d = distance(col, CGA_MAGENTA);
  if (d < bestDist) { bestDist = d; best = CGA_MAGENTA; }

  d = distance(col, CGA_CYAN);
  if (d < bestDist) { bestDist = d; best = CGA_CYAN; }

  if (uUseWhite > 0.5) {
    d = distance(col, CGA_WHITE);
    if (d < bestDist) { bestDist = d; best = CGA_WHITE; }
  }

  return best;
}

vec2 effect(vec2 p, float i, float time) {
  return vec2(
    cos(i * sin(p.x * p.y) + time),
    sin(length(p.y - p.x) * i + time)
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Quantize to low-res grid
  float pixelSize = 8.0;
  vec2 cell = floor(fragCoord / pixelSize);
  vec2 snapped = (cell + 0.5) * pixelSize;

  vec2 p = (2.0 * snapped - iResolution.xy) / max(iResolution.x, iResolution.y);
  p *= uResolution;

  for (int i = 1; i < depth; i++) {
    float fi = float(i);
    p += effect(p, fi, iTime * uSpeed);
  }

  vec3 col = mix(
    mix(uColor1, uColor2, 1.0 - sin(p.x)),
    uColor3,
    cos(p.y + p.x)
  );

  col *= 0.75;

  // Checkerboard dither to CGA palette
  float checker = mod(cell.x + cell.y, 2.0);
  col += (checker - 0.5) * 0.35;
  fragColor = vec4(nearestCGA(col), 1.0);
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`;

const PRESETS = {
  hero: {
    resolution: 2.0,
    speed: 0.1,
    colors: [
      [0x00 / 255, 0xAA / 255, 0xAA / 255],
      [0xAA / 255, 0x00 / 255, 0xAA / 255],
      [0, 0, 0],
    ],
  },
  projects: {
    resolution: 1.1,
    speed: 0.1,
    useWhite: false,
    colors: [
      [0x00 / 255, 0xAA / 255, 0xAA / 255],
      [0xAA / 255, 0x00 / 255, 0xAA / 255],
      [0, 0, 0],
    ],
  },
  contact: {
    resolution: 2.8,
    speed: 0.08,
    colors: [
      [229 / 255, 229 / 255, 229 / 255],
      [221 / 255, 221 / 255, 221 / 255],
      [236 / 255, 236 / 255, 236 / 255],
    ],
  },
  "contact-linkedin": {
    resolution: 2.55,
    speed: 0.075,
    colors: [
      [0, 1, 1],
      [0, 0, 0],
      [0, 0.85, 0.95],
    ],
  },
  "contact-email": {
    resolution: 3.1,
    speed: 0.095,
    colors: [
      [1, 0, 1],
      [0, 0, 0],
      [0.95, 0, 0.85],
    ],
  },
  "contact-linkedin-hover": {
    resolution: 2.55,
    speed: 0.32,
    colors: [
      [0, 1, 1],
      [1, 1, 1],
      [0, 0.9, 0.9],
    ],
  },
  "contact-email-hover": {
    resolution: 3.1,
    speed: 0.4,
    colors: [
      [1, 0, 1],
      [1, 1, 1],
      [0.9, 0, 0.9],
    ],
  },
};

const COLOR_FADE_MS = 150;
const SHADER_CLEANUP_KEY = "__heroShaderCleanup";

function createShader(gl, type, source) {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error("Could not allocate shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }

  const message = gl.getShaderInfoLog(shader) || "Unknown shader error.";
  gl.deleteShader(shader);
  throw new Error(message);
}

function createProgram(gl) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Could not allocate program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown linking error.";
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error(message);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function getShaderPreset(canvas) {
  const presetName = canvas.dataset.shaderPreset || "hero";
  return PRESETS[presetName] || PRESETS.hero;
}

function cloneColors(colors) {
  return colors.map((color) => [...color]);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function mixColors(fromColors, toColors, progress) {
  return fromColors.map((fromColor, index) =>
    fromColor.map((channel, channelIndex) =>
      lerp(channel, toColors[index][channelIndex], progress)
    )
  );
}

function setupInteractivePreset(canvas, setPreset) {
  const basePresetName = canvas.dataset.shaderPreset || "hero";
  const hoverPresetName = canvas.dataset.shaderHoverPreset;
  const card = canvas.closest(".section__contact-card");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (!hoverPresetName || !(card instanceof HTMLElement)) {
    return () => {};
  }

  const activateHover = () => {
    setPreset(hoverPresetName);
  };

  const deactivateHover = () => {
    setPreset(basePresetName);
  };

  const handleFocus = () => {
    if (card.matches(":focus-visible")) {
      activateHover();
    }
  };
  const handlePointerChange = (event) => {
    if (!event.matches) {
      deactivateHover();
    }
  };

  if (!finePointerQuery.matches) {
    deactivateHover();
  }

  card.addEventListener("pointerenter", activateHover);
  card.addEventListener("pointerleave", deactivateHover);
  card.addEventListener("focus", handleFocus);
  card.addEventListener("blur", deactivateHover);
  finePointerQuery.addEventListener("change", handlePointerChange);

  return () => {
    card.removeEventListener("pointerenter", activateHover);
    card.removeEventListener("pointerleave", deactivateHover);
    card.removeEventListener("focus", handleFocus);
    card.removeEventListener("blur", deactivateHover);
    finePointerQuery.removeEventListener("change", handlePointerChange);
  };
}

function mountShader(canvas) {
  if (typeof canvas[SHADER_CLEANUP_KEY] === "function") {
    canvas[SHADER_CLEANUP_KEY]();
  }

  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });

  if (!gl) {
    canvas.remove();
    return;
  }

  let animationFrame = 0;
  let program;
  let positionBuffer;
  let preset = getShaderPreset(canvas);
  let startColors = cloneColors(preset.colors);
  let currentColors = cloneColors(preset.colors);
  let targetColors = cloneColors(preset.colors);
  let startSpeed = preset.speed;
  let currentSpeed = preset.speed;
  let targetSpeed = preset.speed;
  let colorTransitionStart = 0;
  let phaseTime = 0;
  let lastFrameTime = 0;
  let isRendering = false;
  let isVisible = true;
  let cleanupInteractivePreset = () => {};
  let visibilityObserver = null;

  try {
    program = createProgram(gl);
    positionBuffer = gl.createBuffer();

    if (!positionBuffer) {
      throw new Error("Could not allocate buffer.");
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const positionAttribute = gl.getAttribLocation(program, "position");
    const resolutionUniform = gl.getUniformLocation(program, "iResolution");
    const timeUniform = gl.getUniformLocation(program, "iTime");
    const scaleUniform = gl.getUniformLocation(program, "uResolution");
    const speedUniform = gl.getUniformLocation(program, "uSpeed");
    const colorOneUniform = gl.getUniformLocation(program, "uColor1");
    const colorTwoUniform = gl.getUniformLocation(program, "uColor2");
    const colorThreeUniform = gl.getUniformLocation(program, "uColor3");
    const useWhiteUniform = gl.getUniformLocation(program, "uUseWhite");

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (now) => {
      if (!isRendering) return;

      resize();

      if (lastFrameTime === 0) {
        lastFrameTime = now;
      }

      const deltaTime = Math.max(0, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (colorTransitionStart > 0) {
        const progress = Math.min(
          1,
          (now - colorTransitionStart) / COLOR_FADE_MS
        );
        currentColors = mixColors(startColors, targetColors, progress);
        currentSpeed = lerp(startSpeed, targetSpeed, progress);

        if (progress >= 1) {
          colorTransitionStart = 0;
          startColors = cloneColors(targetColors);
          startSpeed = targetSpeed;
        }
      }

      phaseTime += deltaTime * currentSpeed;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionAttribute);
      gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionUniform, canvas.width, canvas.height);
      gl.uniform1f(timeUniform, phaseTime);
      gl.uniform1f(scaleUniform, preset.resolution);
      gl.uniform1f(speedUniform, 1);
      gl.uniform3f(colorOneUniform, ...currentColors[0]);
      gl.uniform3f(colorTwoUniform, ...currentColors[1]);
      gl.uniform3f(colorThreeUniform, ...currentColors[2]);
      gl.uniform1f(useWhiteUniform, preset.useWhite === false ? 0 : 1);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animationFrame = window.requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (isRendering || document.hidden || !isVisible) return;
      isRendering = true;
      animationFrame = window.requestAnimationFrame(render);
    };

    const stopRendering = () => {
      isRendering = false;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        lastFrameTime = 0;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopRendering();
      } else {
        startRendering();
      }
    };

    cleanupInteractivePreset = setupInteractivePreset(canvas, (presetName) => {
      const nextPreset = PRESETS[presetName] || PRESETS.hero;
      preset = nextPreset;
      startColors = cloneColors(currentColors);
      targetColors = cloneColors(nextPreset.colors);
      startSpeed = currentSpeed;
      targetSpeed = nextPreset.speed;
      colorTransitionStart = performance.now();
    });

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          isVisible = entries.some((entry) => entry.isIntersecting);
          if (isVisible) {
            startRendering();
          } else {
            stopRendering();
          }
        },
        { rootMargin: "200px 0px" }
      );
      visibilityObserver.observe(canvas);
    } else {
      startRendering();
    }

    let didCleanup = false;
    const cleanup = () => {
      if (didCleanup) return;
      didCleanup = true;
      stopRendering();
      cleanupInteractivePreset();
      visibilityObserver?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas[SHADER_CLEANUP_KEY] = null;
    };

    canvas[SHADER_CLEANUP_KEY] = cleanup;
    return cleanup;
  } catch (error) {
    console.error("Hero shader failed to initialize.", error);
    canvas.remove();
  }
}

export function initHeroShader() {
  const canvases = document.querySelectorAll("[data-shader-canvas]");
  const cleanups = [];

  canvases.forEach((canvas) => {
    if (canvas instanceof HTMLCanvasElement) {
      const cleanup = mountShader(canvas);
      if (typeof cleanup === "function") {
        cleanups.push(cleanup);
      }
    }
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
