(function (global) {
  const KEY = "andrewsail-map-theme";
  const STYLES = {
    dark: "https://tiles.openfreemap.org/styles/dark",
    light: "https://tiles.openfreemap.org/styles/liberty",
  };

  function readStored() {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") return t;
    } catch (e) {}
    return null;
  }

  function systemTheme() {
    try {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    } catch (e) {}
    return "dark";
  }

  function current() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
    return readStored() || systemTheme();
  }

  function apply(theme, persist) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    if (persist) {
      try { localStorage.setItem(KEY, next); } catch (e) {}
    }
    syncButton(next);
    document.dispatchEvent(new CustomEvent("andrewsail-map-theme", { detail: { theme: next } }));
  }

  function toggle() {
    apply(current() === "light" ? "dark" : "light", true);
  }

  function syncButton(theme) {
    const btn = document.getElementById("map-theme");
    if (!btn) return;
    const now = theme || current();
    const next = now === "light" ? "dark" : "light";
    btn.setAttribute("data-theme-current", now);
    btn.setAttribute("aria-label", "Switch to " + next + " mode");
    btn.setAttribute("title", next === "light" ? "Light mode" : "Dark mode");
  }

  function bind() {
    const btn = document.getElementById("map-theme");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", toggle);
    syncButton();
  }

  if (!document.documentElement.getAttribute("data-theme")) {
    document.documentElement.setAttribute("data-theme", readStored() || systemTheme());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  global.AndrewSailMapTheme = {
    key: KEY,
    styles: STYLES,
    current: current,
    apply: function (t) { apply(t, true); },
    toggle: toggle,
    styleUrl: function (t) {
      return STYLES[(t || current()) === "light" ? "light" : "dark"];
    },
  };
})(window);
