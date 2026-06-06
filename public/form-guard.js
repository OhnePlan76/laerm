(function () {
  const form = document.querySelector("form[data-dirty-check]");
  if (!form) {
    return;
  }

  const message = "Du hast ungespeicherte Eingaben. Seite wirklich verlassen?";
  const durationOutput = form.querySelector("[data-duration-output]");
  let initialState = serialize(form);
  let dirtyOnLoad = form.dataset.dirtyOnLoad === "true";
  let submitting = false;

  function serialize(targetForm) {
    return Array.from(new FormData(targetForm).entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
  }

  function isDirty() {
    return dirtyOnLoad || serialize(form) !== initialState;
  }

  function timeToMinutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) {
      return null;
    }
    const parts = value.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function calculateDuration(startValue, endValue) {
    const start = timeToMinutes(startValue);
    const end = timeToMinutes(endValue);

    if (start === null || end === null) {
      return null;
    }

    return end >= start ? end - start : end + 24 * 60 - start;
  }

  function updateDuration() {
    if (!durationOutput) {
      return;
    }

    const start = form.elements.beginn_uhrzeit ? form.elements.beginn_uhrzeit.value : "";
    const end = form.elements.ende_uhrzeit ? form.elements.ende_uhrzeit.value : "";
    const duration = calculateDuration(start, end);

    durationOutput.textContent = Number.isInteger(duration) ? `${duration} Min.` : "-";
  }

  function currentTimeValue() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  form.addEventListener("input", updateDuration);
  form.addEventListener("change", updateDuration);

  form.addEventListener("click", (event) => {
    const button = event.target.closest("[data-time-now]");
    if (!button) {
      return;
    }

    const field = form.elements[button.dataset.timeNow];
    if (!field) {
      return;
    }

    field.value = currentTimeValue();
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });

  form.addEventListener("submit", () => {
    submitting = true;
    dirtyOnLoad = false;
    initialState = serialize(form);
  });

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest("a[href]");
      if (!link || link.target === "_blank" || link.href.startsWith(`${window.location.origin}${window.location.pathname}#`)) {
        return;
      }

      if (isDirty() && !window.confirm(message)) {
        event.preventDefault();
      }
    },
    true
  );

  window.addEventListener("beforeunload", (event) => {
    if (submitting || !isDirty()) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });

  updateDuration();
})();
