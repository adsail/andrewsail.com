(function () {
  const raw = window.RESTAURANTS;
  const places = Array.isArray(raw) ? raw : (raw && (raw.places || raw.restaurants)) || [];
  const listEl = document.getElementById("map-list");
  const chipsEl = document.getElementById("map-chips");
  const searchEl = document.getElementById("map-filter");

  const neighborhoods = [...new Set(places.map((p) => p.neighborhood).filter(Boolean))];
  let neighborhood = "All";
  let favoritesOnly = false;
  let michelinOnly = false;
  let query = "";
  let activeId = null;
  const markers = {};

  const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/dark",
    center: [-71.08, 42.36],
    zoom: 11.4,
    pitch: 42,
    bearing: -18,
    attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  function visiblePlaces() {
    const q = query.trim().toLowerCase();
    return places.filter((p) => {
      if (favoritesOnly && !p.favorite) return false;
      if (michelinOnly && !p.michelin) return false;
      if (neighborhood !== "All" && p.neighborhood !== neighborhood) return false;
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.blurb || "").toLowerCase().includes(q) ||
        (p.neighborhood || "").toLowerCase().includes(q)
      );
    });
  }


  function michelinLabel(p) {
    if (!p.michelin) return "";
    return p.michelin.label || (p.michelin.award === "bib" ? "Michelin Bib Gourmand" : "Michelin Recommended");
  }
  function bookingLabel(p) {
    const b = p.booking;
    if (!b || !b.url) return null;
    const platform = (b.platform || "").toLowerCase();
    if (platform === "resy") return "Book on Resy";
    if (platform === "tock") return "Book on Tock";
    if (platform === "opentable") return "Book on OpenTable";
    return "Reserve";
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    const make = (label, on, extra, click) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (extra) btn.classList.add(extra);
      if (on) btn.classList.add("is-on");
      btn.addEventListener("click", click);
      chipsEl.appendChild(btn);
    };
    make("All", neighborhood === "All" && !favoritesOnly && !michelinOnly, null, () => {
      neighborhood = "All";
      favoritesOnly = false;
      michelinOnly = false;
      render();
    });
    make("Favorites", favoritesOnly, "fav", () => {
      favoritesOnly = !favoritesOnly;
      render();
    });
    make("Michelin", michelinOnly, "michelin", () => {
      michelinOnly = !michelinOnly;
      render();
    });
    neighborhoods.forEach((n) => {
      make(n, neighborhood === n, null, () => {
        neighborhood = neighborhood === n ? "All" : n;
        render();
      });
    });
  }

  function popupHtml(p) {
    const book = bookingLabel(p);
    const site = p.url
      ? `<a class="popup-book" href="${p.url}" target="_blank" rel="noopener">Website</a>`
      : "";
    const reserve = book
      ? `<a class="popup-book" href="${p.booking.url}" target="_blank" rel="noopener">${book}</a>`
      : "";
    return `<div class="popup-meta">${p.neighborhood || ""}${p.favorite ? " · Favorite" : ""}${p.michelin ? " · " + michelinLabel(p) : ""}</div>
      <p class="popup-name">${p.name}</p>
      <p class="popup-blurb">${p.blurb || ""}</p>
      <div>${[reserve, site].filter(Boolean).join(" · ")}</div>`;
  }

  function focusPlace(p, fly) {
    activeId = p.id;
    document.querySelectorAll(".map-card").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.id === p.id);
    });
    Object.entries(markers).forEach(([id, m]) => {
      m.getElement().classList.toggle("is-active", id === p.id);
    });
    if (p.lng && p.lat && fly !== false) {
      map.flyTo({
        center: [p.lng, p.lat],
        zoom: Math.max(map.getZoom(), 14.2),
        pitch: 52,
        speed: 0.8,
        essential: true,
      });
      new maplibregl.Popup({ offset: 18, closeButton: false })
        .setLngLat([p.lng, p.lat])
        .setHTML(popupHtml(p))
        .addTo(map);
    }
    const card = document.querySelector(`.map-card[data-id="${p.id}"]`);
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function renderList() {
    const vis = visiblePlaces();
    listEl.innerHTML = "";
    vis.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-card" + (p.id === activeId ? " is-active" : "");
      btn.dataset.id = p.id;
      const book = bookingLabel(p);
      btn.innerHTML = `
        <div class="map-card__meta">${p.neighborhood || ""}${p.favorite ? " · 🔥" : ""}${p.michelin ? ` · <span class="map-card__michelin">${michelinLabel(p)}</span>` : ""}</div>
        <h2 class="map-card__name">${p.name}</h2>
        <p class="map-card__blurb">${p.blurb || ""}</p>
        ${book ? `<a class="map-card__book" href="${p.booking.url}" target="_blank" rel="noopener">${book}</a>` : ""}
      `;
      btn.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        focusPlace(p);
      });
      listEl.appendChild(btn);
    });
  }

  function renderMarkers() {
    const vis = new Set(visiblePlaces().map((p) => p.id));
    places.forEach((p) => {
      if (!p.lat || !p.lng) return;
      if (!markers[p.id]) {
        const el = document.createElement("div");
        el.className = "map-marker" + (p.favorite ? " fav" : "") + (p.michelin ? " michelin" : "");
        el.title = p.name;
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        el.addEventListener("click", () => focusPlace(p));
        markers[p.id] = marker;
      }
      markers[p.id].getElement().style.display = vis.has(p.id) ? "block" : "none";
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
    map.resize();
  });
  window.addEventListener("resize", function () { map.resize(); });
})();
