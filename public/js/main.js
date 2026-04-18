import { initAboutCursor } from "./about-cursor.js";
import { initHeroNav } from "./hero-nav.js";
import { initHeroShader } from "./hero-shader.js";
import { initMailto } from "./mailto.js";

const cleanupHeroShader = initHeroShader();
initHeroNav();
initAboutCursor();
initMailto();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupHeroShader?.();
  });
}
