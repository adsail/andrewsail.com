(function () {
  const raw = window.CELLAR;
  const bottles = (function (data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.bottles)) return data.bottles;
    if (data && Array.isArray(data.wines)) return data.wines;
    if (data && typeof data === "object") {
      const vals = Object.values(data);
      if (vals.length && vals.every((v) => v && typeof v === "object" && ("producer" in v || "wine_name" in v))) {
        return vals;
      }
    }
    return [];
  })(raw);

  const gridEl = document.getElementById("cellar-grid");
  const chipsEl = document.getElementById("cellar-chips");
  const searchEl = document.getElementById("cellar-filter");
  const countEl = document.getElementById("cellar-count");
  const toggleEl = document.getElementById("cellar-filters-toggle");

  const TYPE_LABELS = {
    red: "Red",
    white: "White",
    rose: "Rosé",
    sparkling: "Sparkling",
    dessert: "Dessert",
  };
  const STATUS_CHIPS = [
    { id: "all", label: "All" },
    { id: "ready", label: "Ready now" },
    { id: "hold", label: "Hold" },
    { id: "vault", label: "Vault" },
    { id: "drink_soon", label: "Drink soon" },
    { id: "sentimental", label: "Sentimental" },
    { id: "domaine", label: "Domaine" },
  ];
  const TYPE_CHIPS = [
    { id: "red", label: "Red" },
    { id: "white", label: "White" },
    { id: "rose", label: "Rosé" },
    { id: "sparkling", label: "Sparkling" },
    { id: "dessert", label: "Dessert" },
  ];
  const SPECIAL_LABELS = {
    vault: "Vault",
    hold: "Hold",
    drink_soon: "Drink soon",
    sentimental: "Sentimental",
    domaine: "Domaine",
  };
  const COUNTRY_ORDER = [
    "France",
    "Italy",
    "Spain",
    "Portugal",
    "Germany",
    "Greece",
    "South Africa",
    "United Kingdom",
    "United States",
  ];

  function grapePrimaryOf(grapes) {
    let s = String(grapes == null ? "" : grapes).trim();
    if (!s) return "";
    const slash = s.indexOf("/");
    if (slash !== -1) s = s.slice(0, slash).trim();
    s = s.replace(/\s+field\s+blend$/i, "").trim();
    s = s.replace(/\s+blend$/i, "").trim();
    return s;
  }

  bottles.forEach((b, i) => {
    b.grapePrimary = grapePrimaryOf(b.grapes);
    b._id = i;
  });
  let openId = null;

  const COUNTRY_CHIPS = [...new Set(bottles.map((b) => String(b.country || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const GRAPE_CHIPS = [...new Set(bottles.map((b) => b.grapePrimary).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  let status = "all";
  let type = "all";
  let country = "all";
  let grape = "all";
  let query = "";
  let filtersOpen = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function qtyOf(b) {
    const n = Number(b.qty);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function specialOf(b) {
    return String(b.special || "").trim().toLowerCase();
  }

  function typeOf(b) {
    return String(b.wine_type || "").trim().toLowerCase();
  }

  function countryOf(b) {
    return String(b.country || "").trim() || "Other";
  }

  function regionOf(b) {
    return String(b.region || "").trim() || "Other";
  }

  function subregionOf(b) {
    return String(b.subregion || "").trim();
  }

  function vintageYear(b) {
    const n = Number(b.vintage);
    return Number.isFinite(n) ? n : 9999;
  }

  function countryRank(name) {
    const i = COUNTRY_ORDER.indexOf(name);
    return i === -1 ? COUNTRY_ORDER.length : i;
  }

  function matchesStatus(b) {
    const special = specialOf(b);
    if (status === "all") return true;
    if (status === "ready") return b.ready_now === "yes" && special !== "vault" && special !== "hold";
    if (status === "hold") return special === "hold" || b.ready_now === "not_yet";
    if (status === "vault") return special === "vault";
    if (status === "drink_soon") return special === "drink_soon";
    if (status === "sentimental") return special === "sentimental";
    if (status === "domaine") return special === "domaine";
    return true;
  }

  function haystack(b) {
    return [
      b.vintage,
      b.producer,
      b.wine_name,
      b.wine_type,
      TYPE_LABELS[typeOf(b)] || b.wine_type,
      b.grapes,
      b.country,
      b.region,
      b.subregion,
      b.story,
      b.special,
      SPECIAL_LABELS[specialOf(b)] || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  function visibleBottles() {
    const q = query.trim().toLowerCase();
    return bottles
      .filter((b) => {
        if (!matchesStatus(b)) return false;
        if (type !== "all" && typeOf(b) !== type) return false;
        if (country !== "all" && String(b.country || "").trim() !== country) return false;
        if (grape !== "all" && b.grapePrimary !== grape) return false;
        if (q && !haystack(b).includes(q)) return false;
        return true;
      })
      ;
  }

  function drinkWindow(b) {
    const start = b.drink_start;
    const end = b.drink_end;
    if (start && end) return start + "–" + end;
    if (specialOf(b) === "hold" || b.ready_now === "not_yet") return "hold";
    if (b.ready_now === "yes") return "ready";
    return "";
  }

  function placeLine(b) {
    return subregionOf(b) || regionOf(b);
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    const make = (parent, id, label, on, extra, click) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (extra) btn.classList.add(extra);
      if (on) btn.classList.add("is-on");
      btn.addEventListener("click", click);
      parent.appendChild(btn);
    };
    const group = (title) => {
      const wrap = document.createElement("div");
      wrap.className = "map-chip-group";
      const lab = document.createElement("p");
      lab.className = "map-chip-group__label";
      lab.textContent = title;
      const row = document.createElement("div");
      row.className = "map-chip-row";
      wrap.appendChild(lab);
      wrap.appendChild(row);
      chipsEl.appendChild(wrap);
      return row;
    };

    const rack = group("The rack");
    STATUS_CHIPS.forEach((chip) => {
      make(rack, chip.id, chip.label, status === chip.id && (chip.id !== "all" || (type === "all" && country === "all" && grape === "all")), "chip-" + chip.id, () => {
        if (chip.id === "all") {
          status = "all";
          type = "all";
          country = "all";
          grape = "all";
        } else {
          status = status === chip.id ? "all" : chip.id;
        }
        render();
      });
    });

    const types = group("Type");
    TYPE_CHIPS.forEach((chip) => {
      make(types, chip.id, chip.label, type === chip.id, "chip-type-" + chip.id, () => {
        type = type === chip.id ? "all" : chip.id;
        render();
      });
    });

    const countries = group("Country");
    COUNTRY_CHIPS.forEach((name) => {
      make(countries, name, name, country === name, null, () => {
        country = country === name ? "all" : name;
        render();
      });
    });

    const grapes = group("Grape");
    GRAPE_CHIPS.forEach((name) => {
      make(grapes, name, name, grape === name, null, () => {
        grape = grape === name ? "all" : name;
        render();
      });
    });
  }

  function rowHtml(b) {
    const special = specialOf(b);
    const vintage = b.vintage ? esc(b.vintage) : "NV";
    const qty = qtyOf(b);
    const windowText = drinkWindow(b);
    const place = placeLine(b);
    const open = openId === b._id;
    const hasDetail = !!(b.story || (special && SPECIAL_LABELS[special]));
    let detail = "";
    if (open && hasDetail) {
      const bits = [];
      if (special && SPECIAL_LABELS[special]) {
        bits.push('<span class="cellar-badge cellar-badge--' + esc(special) + '">' + esc(SPECIAL_LABELS[special]) + "</span>");
      }
      detail =
        '<div class="cellar-row__detail">' +
        (bits.length ? '<div class="cellar-card__badges">' + bits.join("") + "</div>" : "") +
        (b.story ? '<p class="cellar-row__story">' + esc(b.story) + "</p>" : "") +
        "</div>";
    }
    return (
      '<div class="cellar-item' +
      (open ? " is-open" : "") +
      (special === "vault" ? " is-vault" : "") +
      '">' +
      '<button type="button" class="cellar-row" data-id="' +
      b._id +
      '"' +
      (hasDetail ? "" : " data-static=\"1\"") +
      ">" +
      '<span class="cellar-row__vintage">' +
      vintage +
      "</span>" +
      '<span class="cellar-row__main">' +
      '<span class="cellar-row__producer">' +
      esc(b.producer || "") +
      "</span>" +
      (b.wine_name ? '<span class="cellar-row__name">' + esc(b.wine_name) + "</span>" : "") +
      "</span>" +
      '<span class="cellar-row__place">' +
      esc(place) +
      "</span>" +
      '<span class="cellar-row__qty">' +
      (qty > 1 ? "×" + qty : "") +
      "</span>" +
      '<span class="cellar-row__window">' +
      esc(windowText) +
      "</span>" +
      "</button>" +
      detail +
      "</div>"
    );
  }

  function renderGrid() {
    const vis = visibleBottles();
    const totalLabels = bottles.length;
    const totalBottles = bottles.reduce((sum, b) => sum + qtyOf(b), 0);
    const visBottles = vis.reduce((sum, b) => sum + qtyOf(b), 0);
    const filtered = vis.length !== totalLabels || query.trim() || status !== "all" || type !== "all" || country !== "all" || grape !== "all";

    if (filtered) {
      countEl.textContent =
        vis.length +
        " of " +
        totalLabels +
        " labels · " +
        visBottles +
        " bottle" +
        (visBottles === 1 ? "" : "s");
    } else {
      countEl.textContent = totalLabels + " labels · " + totalBottles + " bottles";
    }

    if (!vis.length) {
      gridEl.innerHTML = '<p class="cellar-empty">Nothing matches.</p>';
      return;
    }

    const sorted = vis.slice().sort((a, b) => {
      const c = countryRank(countryOf(a)) - countryRank(countryOf(b));
      if (c) return c;
      const cc = countryOf(a).localeCompare(countryOf(b));
      if (cc) return cc;
      const r = regionOf(a).localeCompare(regionOf(b));
      if (r) return r;
      const sa = subregionOf(a);
      const sb = subregionOf(b);
      if (sa !== sb) {
        if (!sa) return -1;
        if (!sb) return 1;
        return sa.localeCompare(sb);
      }
      const y = vintageYear(a) - vintageYear(b);
      if (y) return y;
      return String(a.producer || "").localeCompare(String(b.producer || ""));
    });

    let html = "";
    let lastCountry = null;
    let lastRegion = null;
    let lastSub = null;
    sorted.forEach((b) => {
      const ctry = countryOf(b);
      const region = regionOf(b);
      const sub = subregionOf(b);
      if (ctry !== lastCountry) {
        if (lastCountry !== null) html += "</section>";
        html += '<section class="cellar-section">';
        html += '<h2 class="cellar-section__country">' + esc(ctry) + "</h2>";
        lastCountry = ctry;
        lastRegion = null;
        lastSub = null;
      }
      if (region !== lastRegion) {
        html += '<h3 class="cellar-section__region">' + esc(region) + "</h3>";
        lastRegion = region;
        lastSub = null;
      }
      if (sub && sub !== lastSub) {
        html += '<h4 class="cellar-section__sub">' + esc(sub) + "</h4>";
        lastSub = sub;
      }
      html += rowHtml(b);
    });
    if (lastCountry !== null) html += "</section>";
    if (!filtered) {
      html += '<p class="cellar-note">Not a live dump. Swap the CSV when InVintory is back.</p>';
    }
    gridEl.innerHTML = html;
  }

  function activeFilterCount() {
    let n = 0;
    if (status !== "all") n++;
    if (type !== "all") n++;
    if (country !== "all") n++;
    if (grape !== "all") n++;
    return n;
  }

  function syncFiltersToggle() {
    const n = activeFilterCount();
    chipsEl.hidden = !filtersOpen;
    toggleEl.setAttribute("aria-expanded", filtersOpen ? "true" : "false");
    toggleEl.classList.toggle("is-on", filtersOpen || n > 0);
    toggleEl.textContent = n ? "Filters · " + n : "Filters";
  }

  function render() {
    renderChips();
    renderGrid();
    syncFiltersToggle();
  }

  toggleEl.addEventListener("click", () => {
    filtersOpen = !filtersOpen;
    syncFiltersToggle();
  });

  gridEl.addEventListener("click", (e) => {
    const row = e.target.closest(".cellar-row");
    if (!row || row.dataset.static === "1") return;
    const id = Number(row.dataset.id);
    openId = openId === id ? null : id;
    renderGrid();
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    render();
  });

  render();
})();
