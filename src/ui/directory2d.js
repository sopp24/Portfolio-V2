// 2D collection: a complete alternative to the 3D store (no WebGL needed). It keeps the shop's
// principles — bins per category, sleeves with a disc peeking out, a separate SOPP Agents rack —
// and doubles as the crawlable, keyboard-friendly, low-power version.
import { $, h, ico } from "./dom.js";

const TONES = ["cyan", "sun", "coral", "violet", "mint", "sky"];
import { t, L, getLanguage } from "../core/i18n.js";

const coverCache = new Map();
async function coverUrl(project, index) {
  if (coverCache.has(project.id)) return coverCache.get(project.id);
  // loaded on demand so the 2D collection still works when three.js (pulled in by the artwork module) cannot load
  const { drawProjectCover, ensureFonts } = await import("../scene/artwork.js");
  await ensureFonts();
  const canvas = drawProjectCover(project, index, 512);
  const url = canvas.toDataURL("image/jpeg", .86);
  coverCache.set(project.id, url);
  return url;
}

export function createDirectory({ data, onOpenProject, onOpenApp, onAbout, onCv, onContact, onBack, onEnter3d, canEnter3d, canRetry3d = () => true, onLanguage }) {
  const root = $("#mode-2d");
  let filter = "";
  let note = "";
  let visible = false;

  function sleeve(project, index) {
    const img = h("img", { alt: "", loading: "lazy", width: "512", height: "512" });
    coverUrl(project, index).then((src) => { img.src = src; }).catch(() => { img.remove(); const c = (project.artwork || [])[0]; if (c) img.parentElement?.style.setProperty("background", c); });
    const button = h("button", { type: "button", class: "sleeve", "aria-label": `${t("dir.open")} — ${L(project.title)}`, onclick: () => onOpenProject(project, index) },
      h("span", { class: "sleeve-art" }, h("span", { class: "disc" }), img),
      h("span", { class: "sleeve-title", text: L(project.title) }),
      h("span", { class: "sleeve-meta", text: [project.year ? String(project.year) : null, ...(project.categories || []).slice(1).map((id) => { const c = data.categories.find((x) => x.id === id); return c ? L(c) : id; })].filter(Boolean).join(" · ") })
    );
    return button;
  }

  function render() {
    // a full re-render must not drop keyboard focus (language buttons, category filter, primary action)
    const keepFocus = root.contains(document.activeElement) ? document.activeElement.id : "";
    root.replaceChildren();
    const lang = getLanguage();
    const page = h("div", { class: "d2" });
    const top = h("header", { class: "d2-top" },
      h("div", { class: "brand" }, h("span", { class: "brand-mark", "aria-hidden": "true", text: "A" }), h("span", { class: "brand-name", text: t("store.name") })),
      h("div", { class: "actions" },
        h("div", { class: "lang-switch", role: "group", "aria-label": "Language / Langue" },
          ...["fr", "en"].map((code) => h("button", { type: "button", id: `dir-lang-${code}`, "aria-pressed": String(lang === code), text: code.toUpperCase(), onclick: () => onLanguage(code) }))),
        canEnter3d() ? h("button", { type: "button", id: "dir-primary", class: "btn btn-primary", onclick: onBack }, ico("back"), t("dir.back"))
          : (canRetry3d() ? h("button", { type: "button", id: "dir-primary", class: "btn btn-primary", onclick: onEnter3d }, t("dir.enter3d"), ico("send")) : null)
      )
    );
    page.append(top);

    const hero = h("section", { class: "d2-hero" },
      h("h1", { id: "dir-title", text: data.profile.name.toUpperCase() }),
      h("p", { class: "eyebrow", text: t("intro.subtitle") + " · " + t("dir.title") }),
      h("p", { text: L(data.profile.headline) }),
      h("div", { class: "chips" }, h("span", { class: "chip chip-solid", text: L(data.profile.availabilityLine) }))
    );
    if (note) hero.append(h("p", { class: "d2-note", role: "status", text: note }));
    page.append(hero);

    // projects ------------------------------------------------------------------
    const select = h("select", { id: "dir-filter", "aria-label": t("dir.filter"), onchange: (e) => { filter = e.target.value; render(); $("#dir-projects")?.scrollIntoView({ block: "start" }); } },
      h("option", { value: "", text: t("dir.all") }), ...data.categories.map((c) => h("option", { value: c.id, text: L(c), selected: filter === c.id })));
    select.value = filter;
    page.append(h("div", { class: "d2-toolbar" }, select, h("span", { class: "chip", text: t("dir.count", { n: data.projects.length }) })));

    const projects = h("section", { class: "d2-section", id: "dir-projects", "aria-labelledby": "dir-projects-h" }, h("h2", { id: "dir-projects-h" }, t("dir.projects")));
    const indexOf = (p) => data.projects.indexOf(p);
    if (filter) {
      const category = data.categories.find((c) => c.id === filter);
      const items = data.projects.filter((p) => (p.categories || []).includes(filter));
      projects.append(h("div", { class: "bin", dataset: { tone: TONES[Math.max(0, data.categories.indexOf(category)) % TONES.length] } }, h("h3", { text: category ? L(category) : filter }), h("div", { class: "sleeve-grid" }, items.map((p) => sleeve(p, indexOf(p))))));
    } else {
      data.categories.forEach((category, ci) => {
        const items = data.projects.filter((p) => p.categories[0] === category.id);
        if (!items.length) return;
        projects.append(h("div", { class: "bin", dataset: { tone: TONES[ci % TONES.length] } }, h("h3", { text: L(category) }), h("div", { class: "sleeve-grid" }, items.map((p) => sleeve(p, indexOf(p))))));
      });
    }
    page.append(projects);

    // apps rack -------------------------------------------------------------------
    const apps = h("section", { class: "d2-section", "aria-labelledby": "dir-apps-h" }, h("h2", { id: "dir-apps-h" }, t("dir.apps"), h("small", { text: `${data.applications.length} / ${data.applications.length}` })));
    apps.append(h("div", { class: "rack-grid" }, data.applications.map((app) =>
      h("article", { class: "app-card" },
        h("span", { class: "cat", text: L(app.category).toUpperCase() }),
        h("h3", { text: app.name }),
        h("p", { text: L(app.description) }),
        h("div", { class: "row" },
          h("a", { class: "btn btn-small btn-primary", href: app.url, target: "_blank", rel: "noopener noreferrer" }, t("dir.openApp"), ico("ext")),
          h("a", { class: "btn btn-small", href: app.repository, target: "_blank", rel: "noopener noreferrer" }, t("dock.repo"), ico("ext"))
        )
      ))));
    page.append(apps);

    // about / music / cv & contact -------------------------------------------------
    const profile = data.profile;
    const about = h("section", { class: "d2-section", "aria-labelledby": "dir-about-h" }, h("h2", { id: "dir-about-h", text: t("dir.about") }));
    const cols = h("div", { class: "d2-columns" });
    cols.append(h("div", { class: "d2-card" },
      h("h3", { text: t("about.status").toUpperCase() }),
      h("p", { text: `${t("about.master")} · ${t("about.soon")}` }),
      h("p", { text: L(profile.availabilityLine) }),
      (!profile.status.degreeTitle || !profile.status.institution) ? h("p", { class: "d2-note", text: t("about.pendingDegree") }) : null,
      h("button", { type: "button", class: "btn btn-small", text: t("about.title"), onclick: onAbout })
    ));
    cols.append(h("div", { class: "d2-card" },
      h("h3", { text: t("dir.music") }),
      h("p", { text: t("about.musicIntro") }),
      h("div", { class: "chips" }, (profile.music.practices[lang] || profile.music.practices.fr).map((x) => h("span", { class: "chip", text: x }))),
      h("ul", null, profile.music.projects.map((p) => h("li", null, p.name, p.confirmed ? "" : " · " + t("about.toConfirm"))))
    ));
    const links = profile.contact.links.filter((l) => l.url);
    cols.append(h("div", { class: "d2-card" },
      h("h3", { text: t("dir.contact") }),
      profile.cv.url ? h("a", { class: "btn btn-small btn-primary", href: profile.cv.url, download: profile.cv.fileName || "", text: t("cv.download") }) : h("p", { class: "d2-note", text: t("cv.missing") }),
      profile.contact.email ? h("a", { class: "btn btn-small", href: "mailto:" + profile.contact.email, text: profile.contact.email }) : h("p", { text: t("contact.emailMissing") }),
      h("div", { class: "row" }, links.map((l) => h("a", { class: "btn btn-small", href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.label, ico("ext")))),
      h("button", { type: "button", class: "btn btn-small", text: t("contact.title"), onclick: onContact }),
      h("button", { type: "button", class: "btn btn-small", text: t("cv.title"), onclick: onCv })
    ));
    about.append(cols);
    page.append(about);

    page.append(h("footer", { class: "d2-foot" }, h("span", { text: "ADAM SOPPELSA — PROJECTS STORE" }), h("span", { text: "FR / EN" })));
    root.append(page);
    if (keepFocus) document.getElementById(keepFocus)?.focus({ preventScroll: true });
  }

  return {
    show({ message = "" } = {}) {
      note = message; visible = true; root.hidden = false; render();
      root.scrollTop = 0;
      $("#dir-title")?.setAttribute("tabindex", "-1");
      $("#dir-title")?.focus({ preventScroll: true });
    },
    hide() { visible = false; root.hidden = true; },
    refresh() { if (visible) { const top = root.scrollTop; render(); root.scrollTop = top; } },
    isVisible: () => visible
  };
}
