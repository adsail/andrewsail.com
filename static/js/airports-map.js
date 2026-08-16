(function () {
  const raw = window.AIRPORTS;
  const airports = (Array.isArray(raw) ? raw : (raw && raw.airports) || []).map((a) => ({
    ...a,
    id: a.ident,
  }));
  const listEl = document.getElementById("map-list");
  const chipsEl = document.getElementById("map-chips");
  const searchEl = document.getElementById("map-filter");

  const NEW_ENGLAND = new Set(["MA", "ME", "NH", "VT", "RI", "CT"]);
  const WEST = new Set(["NV", "CA", "OR", "WA", "AZ", "UT", "ID", "MT", "WY", "CO", "NM", "AK", "HI"]);

  let region = "All";
  let query = "";
  let activeId = null;
  const markers = {};
  let popup = null;

  const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/dark",
    center: [-96, 39.2],
    zoom: 3.3,
    pitch: 10,
    bearing: -6,
    attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  function regionOf(a) {
    if (NEW_ENGLAND.has(a.state)) return "New England";
    if (WEST.has(a.state)) return "West";
    return "Other";
  }

  function visibleAirports() {
    const q = query.trim().toLowerCase();
    return airports.filter((a) => {
      if (region === "New England" && regionOf(a) !== "New England") return false;
      if (region === "West" && regionOf(a) !== "West") return false;
      if (!q) return true;
      return (
        (a.ident || "").toLowerCase().includes(q) ||
        (a.name || "").toLowerCase().includes(q) ||
        (a.city || "").toLowerCase().includes(q) ||
        (a.state || "").toLowerCase().includes(q)
      );
    });
  }

  function landingsLabel(a) {
    if (a.landings == null) return "not in the logbook";
    return a.landings === 1 ? "1 time" : a.landings + " times";
  }

  function countLabel(a) {
    if (a.landings == null) return "—";
    return "×" + a.landings;
  }

  function placeLine(a) {
    return [a.city, a.state].filter(Boolean).join(", ");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pinKind(a) {
    return a.home ? "home" : "logbook";
  }

  function boundsPadding() {
    const mobile = window.matchMedia("(max-width: 860px)").matches;
    return mobile
      ? { top: 40, bottom: 56, left: 32, right: 32 }
      : { top: 80, bottom: 96, left: 80, right: 96 };
  }

  function fitVisible(opts) {
    const vis = visibleAirports().filter((a) => a.lat && a.lng);
    if (!vis.length) return;
    const bounds = new maplibregl.LngLatBounds();
    vis.forEach((a) => bounds.extend([a.lng, a.lat]));
    map.fitBounds(bounds, {
      padding: boundsPadding(),
      pitch: vis.length === 1 ? 22 : 10,
      bearing: -6,
      maxZoom: vis.length === 1 ? 10.8 : 12,
      duration: opts && opts.instant ? 0 : 900,
      essential: true,
    });
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    [
      ["All", "All", null],
      ["New England", "New England", null],
      ["West", "West", null],
    ].forEach(([label, value, extra]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (extra) btn.classList.add(extra);
      if (region === value) btn.classList.add("is-on");
      btn.addEventListener("click", () => {
        region = value;
        render();
        fitVisible();
      });
      chipsEl.appendChild(btn);
    });
  }

  function popupHtml(a) {
    return `<div class="popup-meta">${escapeHtml(a.ident)}${a.home ? " · Home base" : ""}</div>
      <p class="popup-name">${escapeHtml(a.name)}</p>
      <p class="popup-blurb">${escapeHtml(placeLine(a))}<br>${escapeHtml(landingsLabel(a))}</p>`;
  }

  function showPopup(a) {
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ offset: 22, closeButton: false })
      .setLngLat([a.lng, a.lat])
      .setHTML(popupHtml(a))
      .addTo(map);
  }

  function focusAirport(a, fly) {
    activeId = a.id;
    document.querySelectorAll(".map-card").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.id === a.id);
    });
    Object.entries(markers).forEach(([id, m]) => {
      m.getElement().classList.toggle("is-active", id === a.id);
    });
    if (a.lng && a.lat && fly !== false) {
      map.flyTo({
        center: [a.lng, a.lat],
        zoom: Math.max(map.getZoom(), 10.6),
        pitch: 24,
        bearing: -6,
        speed: 0.85,
        essential: true,
      });
      showPopup(a);
    }
    const card = document.querySelector(`.map-card[data-id="${a.id}"]`);
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function renderList() {
    const vis = visibleAirports().slice().sort((a, b) => (b.landings || 0) - (a.landings || 0));
    listEl.innerHTML = "";
    vis.forEach((a) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-card" + (a.id === activeId ? " is-active" : "");
      btn.dataset.id = a.id;
      const extra = a.home ? " · Home base" : "";
      btn.innerHTML = `
        <div class="map-card__row">
          <div>
            <div class="map-card__ident">${escapeHtml(a.ident)}${extra}</div>
            <h2 class="map-card__name">${escapeHtml(a.name)}</h2>
            <p class="map-card__meta">${escapeHtml(placeLine(a))}</p>
          </div>
          <div class="map-card__count">${escapeHtml(countLabel(a))}</div>
        </div>
      `;
      btn.addEventListener("click", () => focusAirport(a));
      listEl.appendChild(btn);
    });
  }

  function renderMarkers() {
    const vis = new Set(visibleAirports().map((a) => a.id));
    airports.forEach((a) => {
      if (!a.lat || !a.lng) return;
      if (!markers[a.id]) {
        const el = document.createElement("div");
        el.className = "map-pin " + pinKind(a);
        el.title = a.ident + " — " + a.name;
        el.innerHTML = `<span class="map-pin__ident">${escapeHtml(a.ident)}</span><div class="map-marker"></div>`;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([a.lng, a.lat])
          .addTo(map);
        el.addEventListener("click", () => focusAirport(a));
        markers[a.id] = marker;
      }
      markers[a.id].getElement().style.display = vis.has(a.id) ? "flex" : "none";
    });
  }

  function render() {
    renderChips();
    renderList();
    renderMarkers();
  }

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    render();
  });

  map.on("load", function () {
    render();
    fitVisible({ instant: true });
    map.resize();
  });
  window.addEventListener("resize", function () { map.resize(); });
})();
