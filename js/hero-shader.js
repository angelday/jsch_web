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

const int depth = 4;

vec2 effect(vec2 p, float i, float time) {
  return vec2(
    cos(i * sin(p.x * p.y) + time),
    sin(length(p.y - p.x) * i + time)
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (2.0 * fragCoord - iResolution.xy) / max(iResolution.x, iResolution.y);
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

  fragColor = vec4(col, 1.0);
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}
`;

const PRESETS = {
  hero: {
    resolution: 3.2,
    speed: 0.1,
    colors: [
      [0, 0, 0],
      [46 / 255, 46 / 255, 46 / 255],
      [61 / 255, 61 / 255, 61 / 255],
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
      [229 / 255, 229 / 255, 229 / 255],
      [225 / 255, 225 / 255, 225 / 255],
      [232 / 255, 232 / 255, 232 / 255],
    ],
  },
  "contact-email": {
    resolution: 3.1,
    speed: 0.095,
    colors: [
      [229 / 255, 229 / 255, 229 / 255],
      [226 / 255, 226 / 255, 226 / 255],
      [234 / 255, 234 / 255, 234 / 255],
    ],
  },
  "contact-linkedin-hover": {
    resolution: 2.55,
    speed: 0.32,
    colors: [
      [229 / 255, 229 / 255, 229 / 255],
      [236 / 255, 236 / 255, 236 / 255],
      [1, 1, 1],
    ],
  },
  "contact-email-hover": {
    resolution: 3.1,
    speed: 0.4,
    colors: [
      [229 / 255, 229 / 255, 229 / 255],
      [236 / 255, 236 / 255, 236 / 255],
      [1, 1, 1],
    ],
  },
};

const COLOR_FADE_MS = 150;

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
    return;
  }

  const activateHover = () => {
    setPreset(hoverPresetName);
  };

  const deactivateHover = () => {
    setPreset(basePresetName);
  };

  if (!finePointerQuery.matches) {
    deactivateHover();
    return;
  }

  card.addEventListener("pointerenter", activateHover);
  card.addEventListener("pointerleave", deactivateHover);
  card.addEventListener("focus", () => {
    if (card.matches(":focus-visible")) {
      activateHover();
    }
  });
  card.addEventListener("blur", deactivateHover);

  finePointerQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      deactivateHover();
    }
  });
}

function mountShader(canvas) {
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

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animationFrame = window.requestAnimationFrame(render);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(animationFrame);
        lastFrameTime = 0;
        return;
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    setupInteractivePreset(canvas, (presetName) => {
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
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    };
  } catch (error) {
    console.error("Hero shader failed to initialize.", error);
    canvas.remove();
  }
}

export function initHeroShader() {
  const canvases = document.querySelectorAll("[data-shader-canvas]");

  canvases.forEach((canvas) => {
    if (canvas instanceof HTMLCanvasElement) {
      mountShader(canvas);
    }
  });
}
