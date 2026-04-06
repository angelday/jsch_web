const ANIMATION_MS = 300;

function getTargetModal(opener) {
  const selector = opener.dataset.theatreOpen || opener.getAttribute("href");

  if (!selector || !selector.startsWith("#")) {
    return null;
  }

  const modal = document.querySelector(selector);
  return modal instanceof HTMLElement && modal.hasAttribute("data-theatre-modal")
    ? modal
    : null;
}

export function initTheatreModals() {
  const openers = document.querySelectorAll("[data-theatre-open]");
  const modals = document.querySelectorAll("[data-theatre-modal]");

  if (openers.length === 0 || modals.length === 0) {
    return;
  }

  let activeModal = null;
  let previouslyFocused = null;
  let closeTimeoutId = 0;

  const openModal = (modal) => {
    if (!(modal instanceof HTMLElement)) {
      return;
    }

    if (activeModal && activeModal !== modal) {
      activeModal.hidden = true;
      activeModal.classList.remove("is-open", "is-closing");
    }

    window.clearTimeout(closeTimeoutId);
    previouslyFocused = document.activeElement;
    activeModal = modal;
    modal.hidden = false;
    modal.classList.remove("is-closing");
    document.body.classList.add("has-modal-open");

    window.requestAnimationFrame(() => {
      modal.classList.add("is-open");
    });

    const panel = modal.querySelector(".theatre-modal__panel");

    if (panel instanceof HTMLElement) {
      panel.focus();
    }
  };

  const closeModal = (modal) => {
    if (!(modal instanceof HTMLElement) || modal.hidden) {
      return;
    }

    modal.classList.remove("is-open");
    modal.classList.add("is-closing");

    closeTimeoutId = window.setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove("is-closing");

      if (activeModal === modal) {
        activeModal = null;
        document.body.classList.remove("has-modal-open");
      }

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    }, ANIMATION_MS);
  };

  openers.forEach((opener) => {
    opener.addEventListener("click", (event) => {
      event.preventDefault();
      openModal(getTargetModal(opener));
    });
  });

  modals.forEach((modal) => {
    modal.querySelectorAll("[data-theatre-modal-close]").forEach((closer) => {
      closer.addEventListener("click", () => {
        closeModal(modal);
      });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeModal) {
      closeModal(activeModal);
    }
  });
}
