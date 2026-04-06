// Lightbox
(function () {
  // Build lightbox DOM
  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.innerHTML =
    '<div class="lightbox-content">' +
    '<img class="lightbox-img" draggable="false" />' +
    '<button class="lightbox-close" aria-label="Close">&times;</button>' +
    '<button class="lightbox-prev" aria-label="Previous">&lsaquo;</button>' +
    '<button class="lightbox-next" aria-label="Next">&rsaquo;</button>' +
    '<div class="lightbox-counter"></div>' +
    "</div>";
  document.body.appendChild(overlay);

  const img = overlay.querySelector(".lightbox-img");
  const counter = overlay.querySelector(".lightbox-counter");
  let images = [];
  let current = 0;

  // Pan state
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startTranslateX = 0;
  let startTranslateY = 0;

  function applyTransform() {
    img.style.transform = "translate(" + translateX + "px, " + translateY + "px)";
  }

  function clampTranslate() {
    const imgWidth = img.offsetWidth;
    const imgHeight = img.offsetHeight;
    const maxX = Math.max(0, (imgWidth - window.innerWidth) / 2);
    const maxY = Math.max(0, (imgHeight - window.innerHeight) / 2);
    translateX = Math.max(-maxX, Math.min(maxX, translateX));
    translateY = Math.max(-maxY, Math.min(maxY, translateY));
  }

  function resetPan() {
    translateX = 0;
    translateY = 0;
    overlay.classList.remove("lightbox-dragging");
    img.style.transform = "";
  }

  function show(index) {
    resetPan();
    current = index;
    // Use the highest resolution src available
    const source = images[current];
    img.src = source.srcset
      ? source.srcset.split(",").pop().trim().split(" ")[0]
      : source.src;
    counter.textContent = images.length > 1 ? current + 1 + " / " + images.length : "";
    overlay.classList.add("lightbox-open");
    document.body.style.overflow = "hidden";
  }

  function hide() {
    resetPan();
    overlay.classList.remove("lightbox-open");
    document.body.style.overflow = "";
    img.src = "";
  }

  function next() {
    show((current + 1) % images.length);
  }

  function prev() {
    show((current - 1 + images.length) % images.length);
  }

  // Click on gallery or standalone images
  document.querySelectorAll(".kg-gallery-image img, .kg-image-card img").forEach(function (el) {
    if (el.hasAttribute("data-no-lightbox")) return;
    el.style.cursor = "pointer";
    el.addEventListener("click", function () {
      // Collect all images in the same gallery, or just this one
      const gallery = el.closest(".kg-gallery-card");
      if (gallery) {
        images = Array.from(gallery.querySelectorAll("img"));
        current = images.indexOf(el);
      } else {
        images = [el];
        current = 0;
      }
      show(current);
    });
  });

  // Controls
  overlay.querySelector(".lightbox-close").addEventListener("click", hide);
  overlay.querySelector(".lightbox-prev").addEventListener("click", function (e) {
    e.stopPropagation();
    prev();
  });
  overlay.querySelector(".lightbox-next").addEventListener("click", function (e) {
    e.stopPropagation();
    next();
  });

  // Swallow image clicks (so overlay click-to-close doesn't trigger mid-drag)
  img.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // Prevent Safari's native image drag
  img.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });

  // Drag to pan
  img.addEventListener("mousedown", function (e) {
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startTranslateX = translateX;
    startTranslateY = translateY;
    overlay.classList.add("lightbox-dragging");
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;
    e.preventDefault();
    translateX = startTranslateX + (e.clientX - dragStartX);
    translateY = startTranslateY + (e.clientY - dragStartY);
    clampTranslate();
    applyTransform();
  });

  document.addEventListener("mouseup", function () {
    if (!isDragging) return;
    isDragging = false;
    overlay.classList.remove("lightbox-dragging");
  });

  // Click overlay background to close
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || e.target.className === "lightbox-content") {
      hide();
    }
  });

  // Keyboard
  document.addEventListener("keydown", function (e) {
    if (!overlay.classList.contains("lightbox-open")) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  // Touch support for mobile — drag to pan
  img.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    startTranslateX = translateX;
    startTranslateY = translateY;
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    isDragging = true;
    overlay.classList.add("lightbox-dragging");
  }, { passive: true });

  img.addEventListener("touchmove", function (e) {
    if (!isDragging || e.touches.length !== 1) return;
    var t = e.touches[0];
    translateX = startTranslateX + (t.clientX - dragStartX);
    translateY = startTranslateY + (t.clientY - dragStartY);
    clampTranslate();
    applyTransform();
    e.preventDefault();
  }, { passive: false });

  img.addEventListener("touchend", function () {
    if (!isDragging) return;
    isDragging = false;
    overlay.classList.remove("lightbox-dragging");
  }, { passive: true });
})();
