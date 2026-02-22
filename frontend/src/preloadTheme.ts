(() => {
  const STORAGE_KEY = "theme-mode";
  const root = document.documentElement;
  root.classList.add("no-theme-transition");

  let mode: "light" | "dark" | "system" = "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      mode = stored;
    } else {
      window.localStorage.setItem(STORAGE_KEY, "light");
    }
  } catch {
    // Ignore storage failures; default to light.
  }

  const resolved =
    mode === "system"
      ? window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;

  root.dataset.themeMode = mode;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");

  requestAnimationFrame(() => {
    root.classList.remove("no-theme-transition");
  });
})();

