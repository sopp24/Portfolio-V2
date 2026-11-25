// Content panels: project sheet (liner notes), About, CV, Contact, poster info.
// Rendering never uses innerHTML with data. Empty / null fields are never displayed.
import { h } from "./dom.js";
import { t, L, getLanguage } from "../core/i18n.js";

const hasText = (value) => !!L(value);
const list = (value) => (value && (value[getLanguage()] || value.fr)) || [];

export function categoryLabel(categories, id) {
  const category = categories.find((c) => c.id === id);
  return category ? L(category) : id;
}

function isSafeUrl(url) {
  try { const u = new URL(url, location.href); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}

function section(title, ...content) {
  return h("section", null, h("h3", { text: title }), ...content);
}

// -------------------------------------------------------------------------------------------
// Project sheet (used in the 3D liner panel and the 2D dialog)
// -------------------------------------------------------------------------------------------
export function renderProjectSheet(project, categories, { index = null, kind = "project" } = {}) {
  const lang = getLanguage();
  const root = h("article", { class: "liner" });
  const cat = index !== null ? `SIDE A · CAT. ${String(index + 1).padStart(3, "0")}` : "SIDE A";
  root.append(h("p", { class: "kicker", text: kind === "music" ? `${cat} · ${t("dock.music").toUpperCase()}` : cat }));
  root.append(h("h2", { id: "liner-title", text: L(project.title) }));

  const chips = h("div", { class: "chips" });
  chips.append(h("span", { class: project.year ? "chip chip-solid" : "chip chip-warn", text: project.year ? String(project.year) : t("liner.yearTbc") }));
  for (const id of project.categories || []) chips.append(h("span", { class: "chip", text: categoryLabel(categories, id) }));
  if (project.visualStatus === "provisional") chips.append(h("span", { class: "chip chip-warn", text: t("dock.provisional") }));
  root.append(chips);

  if (hasText(project.short)) root.append(h("p", { text: L(project.short) }));
  if (hasText(project.context)) root.append(section(t("liner.context"), h("p", { text: L(project.context) })));
  if (hasText(project.challenge)) root.append(section(t("liner.challenge"), h("p", { text: L(project.challenge) })));
  if (hasText(project.role)) root.append(section(t("liner.role"), h("p", { text: L(project.role) })));
  const work = list(project.work);
  if (work.length) root.append(section(t("liner.work"), h("ol", null, work.map((item) => h("li", null, h("span", { text: item }))))));

  const skills = (lang === "en" ? project.skillsEn : project.skills) || project.skills || [];
  if (skills.length) root.append(section(t("liner.skills"), h("div", { class: "chips" }, skills.map((s) => h("span", { class: "chip", text: s })))));
  const tools = project.tools || [];
  if (tools.length) root.append(section(t("liner.tools"), h("div", { class: "chips" }, tools.map((s) => h("span", { class: "chip", text: s })))));
  if ((project.collaborators || []).length) root.append(section(t("liner.collaborators"), h("p", { text: project.collaborators.join(" · ") })));
  if (hasText(project.outcome)) root.append(section(t("liner.outcome"), h("p", { text: L(project.outcome) })));

  // optional media / links: rendered only when the data provides them
  const images = (project.images || []).filter((img) => img && isSafeUrl(img.src || img));
  if (images.length) {
    root.append(section(t("liner.documents"), h("div", { class: "gallery" }, images.map((img) => {
      const src = img.src || img;
      return h("img", { src, alt: L(img.alt) || L(project.title), loading: "lazy", style: "width:100%;border-radius:6px;margin-bottom:.5rem" });
    }))));
  }
  const links = [...(project.links || []), ...(project.documents || []), ...(project.videos || [])].filter((l) => l && l.url && isSafeUrl(l.url));
  if (project.externalUrl && isSafeUrl(project.externalUrl)) links.unshift({ label: t("liner.externalLink"), url: project.externalUrl });
  if (links.length) {
    root.append(section(t("liner.links"), h("ul", { class: "link-list" }, links.map((l) =>
      h("li", null, h("a", { class: "btn btn-small", href: l.url, target: "_blank", rel: "noopener noreferrer", text: (L(l.label) || l.url) + " ↗" }))))));
  }
  const notes = [];
  if (project.visualStatus === "provisional") notes.push(t("liner.provisionalNote"));
  if (!project.year) notes.push(t("liner.pendingNote"));
  if (notes.length) root.append(h("p", { class: "note", text: notes.join(" ") }));
  return root;
}

// -------------------------------------------------------------------------------------------
// About
// -------------------------------------------------------------------------------------------
export function renderAbout(profile, { onCv, onContact, onAsk } = {}) {
  const root = h("div", { class: "dialog-body" });
  root.append(h("p", { class: "kicker", text: "SIDE A · " + t("about.title") }));
  root.append(h("h2", { id: "info-title", text: profile.name }));
  root.append(h("p", { text: L(profile.headline) }));
  const status = h("div", { class: "chips" });
  status.append(h("span", { class: "chip chip-solid", text: `${t("about.master")} · ${t("about.soon")}` }));
  if (profile.status.availableFrom) status.append(h("span", { class: "chip chip-solid", text: L(profile.availabilityLine) }));
  root.append(status);
  if (!profile.status.degreeTitle || !profile.status.institution) root.append(h("p", { class: "pending", text: t("about.pendingDegree") }));

  root.append(section(t("about.skills"), h("div", { class: "two" }, profile.skillGroups.map((group) =>
    h("div", null, h("p", { text: L(group) , style: "font-weight:600;margin-bottom:.35rem" }), h("div", { class: "chips" }, list(group.items).map((item) => h("span", { class: "chip", text: item }))))))));

  // Music is part of the identity, not a footnote
  const music = h("div", { class: "two" });
  music.append(h("div", null, h("p", { text: t("about.musicIntro") }), h("h3", { text: t("about.practices"), style: "margin-top:.9rem" }), h("div", { class: "chips" }, list(profile.music.practices).map((p) => h("span", { class: "chip", text: p })))));
  const releases = h("div", null, h("h3", { text: t("about.releases") }), h("ul", null, profile.music.projects.map((p) => h("li", null, p.name, " ", p.confirmed ? "" : h("span", { class: "chip chip-warn", text: t("about.toConfirm") })))));
  if (profile.music.historical && profile.music.historical.yearsOfPractice) {
    releases.append(h("p", { class: "pending", style: "margin-top:.8rem", text: t("about.historicalMusic", { years: profile.music.historical.yearsOfPractice, streams: profile.music.historical.streamsOrUses }) }));
  }
  music.append(releases);
  root.append(section(t("about.music"), music));

  // Historical path: clearly flagged as to-be-confirmed
  const path = [];
  for (const e of profile.education) path.push({ label: L(e.title), meta: e.institution || "", confirmed: e.confirmed });
  for (const e of profile.experience) path.push({ label: `${L(e.title)} — ${e.organisation}${e.location ? ", " + e.location : ""}`, meta: e.year ? String(e.year) : "", confirmed: e.confirmed });
  if (path.length) {
    root.append(section(t("about.path"), h("p", { class: "pending", text: t("about.pathNote"), style: "margin-bottom:.7rem" }),
      h("ul", { class: "timeline" }, path.map((p) => h("li", null, h("strong", { text: p.label }), p.meta ? h("span", { text: p.meta }) : null, p.confirmed ? null : h("span", { class: "chip chip-warn", text: t("about.toConfirm") }))))));
  }

  const actions = h("div", { class: "chips" });
  actions.append(h("button", { type: "button", class: "btn btn-primary", text: t("about.cv"), onclick: () => onCv && onCv() }));
  actions.append(h("button", { type: "button", class: "btn", text: t("about.contact"), onclick: () => onContact && onContact() }));
  if (onAsk) actions.append(h("button", { type: "button", class: "btn", text: t("menu.shopkeeper"), onclick: () => onAsk() }));
  root.append(actions);
  return root;
}

// -------------------------------------------------------------------------------------------
// CV
// -------------------------------------------------------------------------------------------
export function renderCv(profile, { onAbout, onAsk } = {}) {
  const root = h("div", { class: "dialog-body" });
  root.append(h("p", { class: "kicker", text: "SIDE A" }));
  root.append(h("h2", { id: "info-title", text: t("cv.title") }));
  if (profile.cv.url && isSafeUrl(profile.cv.url)) {
    root.append(h("p", { text: `${profile.name} — ${L(profile.headline)}` }));
    root.append(h("div", { class: "chips" }, h("a", { class: "btn btn-primary", href: profile.cv.url, download: profile.cv.fileName || "", target: "_blank", rel: "noopener", text: t("cv.download") })));
  } else {
    root.append(h("p", { class: "pending", text: t("cv.missing") }));
    root.append(h("p", { text: t("cv.askShopkeeper") }));
    const actions = h("div", { class: "chips" });
    if (onAbout) actions.append(h("button", { type: "button", class: "btn", text: t("about.title"), onclick: () => onAbout() }));
    if (onAsk) actions.append(h("button", { type: "button", class: "btn", text: t("menu.shopkeeper"), onclick: () => onAsk() }));
    root.append(actions);
  }
  return root;
}

// -------------------------------------------------------------------------------------------
// Contact
// -------------------------------------------------------------------------------------------
export function renderContact(profile) {
  const root = h("div", { class: "dialog-body" });
  root.append(h("p", { class: "kicker", text: "SIDE A · " + t("contact.intro") }));
  root.append(h("h2", { id: "info-title", text: t("contact.title") }));
  const links = profile.contact.links.filter((l) => l.url && isSafeUrl(l.url));
  const items = h("ul", { class: "link-list" });
  if (profile.contact.email) items.append(h("li", null, h("a", { class: "btn btn-primary", href: "mailto:" + profile.contact.email, text: profile.contact.email })));
  for (const link of links) items.append(h("li", null, h("a", { class: "btn", href: link.url, target: "_blank", rel: "noopener noreferrer", text: link.label + " ↗" })));
  if (profile.portfolioV1) items.append(h("li", null, h("a", { class: "btn btn-small", href: profile.portfolioV1, target: "_blank", rel: "noopener noreferrer", text: t("contact.legacy") + " ↗" })));
  root.append(items);
  if (!profile.contact.email) root.append(h("p", { class: "pending", text: t("contact.emailMissing") }));
  if (profile.contact.links.some((l) => !l.url)) root.append(h("p", { class: "pending", text: t("contact.linksMissing") }));
  return root;
}

export function renderPoster(poster) {
  const root = h("div", { class: "dialog-body" });
  root.append(h("p", { class: "kicker", text: "SIDE A · " + t("poster.title") }));
  root.append(h("h2", { id: "info-title", text: poster.title }));
  root.append(h("p", { text: t("poster.note") }));
  return root;
}
