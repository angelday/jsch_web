import { initAboutCursor } from "./about-cursor.js";
import { initHeroNav } from "./hero-nav.js";
import { initHeroShader } from "./hero-shader.js";
import { initMailto } from "./mailto.js";
import { playSound } from "./pc-sound.js";

const cleanupHeroShader = initHeroShader();
initHeroNav();
initAboutCursor();
initMailto();

document.querySelectorAll("[data-pc-sound]").forEach((el) => {
  el.addEventListener("click", (e) => {
    const href = el.closest("a")?.href;
    if (href) e.preventDefault();
    playSound(el.dataset.pcSound, {
      onStart: () => el.dispatchEvent(new CustomEvent("pc-sound-start")),
    }).then(() => {
      el.dispatchEvent(new CustomEvent("pc-sound-end"));
      if (href) window.location.href = href;
    });
  });
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupHeroShader?.();
  });
}
