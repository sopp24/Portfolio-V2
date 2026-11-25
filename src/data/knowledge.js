// Knowledge base for the shopkeeper (browser + Cloudflare Worker). Pure module: no DOM, no network.
//
//   buildKnowledge({ projects, categories, applications, profile })  -> structured, bilingual KB
//   renderKnowledgeForPrompt(kb, { lang })                           -> text block for the model context
//   KNOWN_ACTION_TARGETS / isKnownActionTarget(type, id)             -> validation of [[...]] pointers
//
// Everything here is derived from the validated data modules. Nothing is invented: null/empty values are
// dropped, unconfirmed facts carry status "historical-unconfirmed" and missing facts are listed in `notProvided`.

import { PROJECTS, CATEGORIES } from "./projects.js";
import { APPLICATIONS } from "./applications.js";
import { PROFILE } from "./profile.js";

export const KB_VERSION = 1;
export const STATUS_CONFIRMED = "confirmed";
export const STATUS_HISTORICAL = "historical-unconfirmed";

/** Recursively removes null / undefined / "" / [] / {} so empty fields never reach a visitor or a model. */
export function compact(value) {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter(item => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const cleaned = compact(item);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function bilingual(obj) {
  return compact({ fr: obj?.fr, en: obj?.en });
}

function statusOf(item) {
  return item && item.confirmed === false ? STATUS_HISTORICAL : STATUS_CONFIRMED;
}

function workModeOf(project) {
  const collaborators = project.collaborators || [];
  if (collaborators.length) return "collaborative";
  const role = `${project.role?.fr || ""} ${project.role?.en || ""}`;
  if (/projet personnel|personal project/i.test(role)) return "personal";
  if (/collectif|collaborative|collaboration/i.test(role)) return "collaborative";
  return "unspecified";
}

function buildProject(project, categoryIndex) {
  const primary = project.categories?.[0];
  return compact({
    id: project.id,
    title: bilingual(project.title),
    year: project.year,
    primaryCategory: primary,
    categories: (project.categories || []).map(id => ({ id, ...bilingual(categoryIndex.get(id) || {}) })),
    summary: bilingual(project.short),
    context: bilingual(project.context),
    challenge: bilingual(project.challenge),
    role: bilingual(project.role),
    workMode: workModeOf(project),
    collaborators: project.collaborators,
    work: { fr: project.work?.fr, en: project.work?.en },
    skills: { fr: project.skills, en: project.skillsEn || project.skills },
    outcome: bilingual(project.outcome),
    artworkStatus: project.visualStatus === "provisional" ? "provisional" : undefined
  });
}

function buildNotProvided(profile, projects) {
  const list = [];
  const add = (id, fr, en) => list.push({ id, fr, en });
  const status = profile.status || {};
  if (!status.degreeTitle) add("degree-title", "Intitulé exact du Master 2", "Exact title of the Master’s 2");
  if (!status.institution) add("institution", "Établissement du Master 2", "Institution of the Master’s 2");
  if (!status.availableFromDate) add("availability-date", "Date exacte de disponibilité (seul le mois de septembre est confirmé)", "Exact availability date (only the month of September is confirmed)");
  if (!profile.cv?.url) add("cv-file", "Fichier de CV téléchargeable (en cours de mise à jour)", "Downloadable CV file (being updated)");
  if (!profile.contact?.email) add("email", "Adresse e-mail confirmée", "Confirmed e-mail address");
  for (const link of profile.contact?.links || []) {
    if (!link.url) add(`link-${link.id}`, `Lien ${link.label}`, `${link.label} link`);
  }
  add("tools", "Liste confirmée de logiciels et d’outils maîtrisés", "Confirmed list of software and tools");
  add("internship-missions", "Missions détaillées des stages", "Detailed internship assignments");
  add("metrics", "Résultats chiffrés (hors ce que les fiches projet indiquent)", "Quantified results (beyond what the project sheets state)");
  const undated = projects.filter(project => project.year == null).length;
  if (undated) add("project-years", `Année de réalisation de ${undated} projets sur ${projects.length}`, `Year of completion for ${undated} of ${projects.length} projects`);
  return list;
}

const FAQ_ANCHORS = [
  { id: "who", q: { fr: "Qui est Adam Soppelsa ?", en: "Who is Adam Soppelsa?" },
    guide: { fr: "Identité, niveau Master 2, profil polyvalent, familles de compétences. Rester factuel.", en: "Identity, Master’s 2 level, versatile profile, skill families. Stay factual." }, pointTo: [{ type: "about" }] },
  { id: "background", q: { fr: "Quel est son parcours ?", en: "What is his background?" },
    guide: { fr: "Master 2 (intitulé et établissement non fournis). BUT et stages = historique à confirmer.", en: "Master’s 2 (title and institution not provided). BUT and internships = historical, to be confirmed." }, pointTo: [{ type: "about" }] },
  { id: "skills", q: { fr: "Quelles sont ses compétences ?", en: "What are his skills?" },
    guide: { fr: "Utiliser skillGroups et les compétences des fiches projet. Aucun logiciel sans confirmation.", en: "Use skillGroups and project skills. No software unless confirmed." }, pointTo: [{ type: "about" }] },
  { id: "experience", q: { fr: "Quelles expériences professionnelles a-t-il réalisées ?", en: "What professional experience does he have?" },
    guide: { fr: "Stages 2023 (BMW / BMW Motorrad, La Rochelle) et 2024 (The Lifestyle Company) = historique à confirmer ; missions non fournies.", en: "2023 (BMW / BMW Motorrad, La Rochelle) and 2024 (The Lifestyle Company) internships = historical, to be confirmed; assignments not provided." }, pointTo: [{ type: "about" }] },
  { id: "best-projects", q: { fr: "Quels sont ses projets les plus intéressants ?", en: "What are his most interesting projects?" },
    guide: { fr: "Ne classe pas les projets : les dix sont au même niveau. Proposer selon l’intérêt du visiteur et les catégories.", en: "Do not rank projects: all ten are on equal footing. Suggest by the visitor’s interest and by category." }, pointTo: [] },
  { id: "expodata-role", q: { fr: "Quel était son rôle dans ExpoData ?", en: "What was his role in ExpoData?" },
    guide: { fr: "Rôle de la fiche expodata ; travail collectif, copilotage avec Louise Munier.", en: "Role from the expodata sheet; collective work, co-led with Louise Munier." }, pointTo: [{ type: "project", id: "expodata" }] },
  { id: "wero", q: { fr: "Peux-tu m’expliquer le projet Wero ?", en: "Can you explain the Wero project?" },
    guide: { fr: "Projet scolaire, collaboration avec Abel M’SOILI, livret + cinq messages.", en: "Academic project, collaboration with Abel M’SOILI, booklet + five messages." }, pointTo: [{ type: "project", id: "wero" }] },
  { id: "swim-sync", q: { fr: "Que représente SWIM SYNC ?", en: "What does SWIM SYNC represent?" },
    guide: { fr: "Objet connecté du Hackathon POCL 2025 ; la répartition individuelle reste à préciser.", en: "Connected object from the 2025 POCL Hackathon; individual split still to be confirmed." }, pointTo: [{ type: "project", id: "swim-sync" }] },
  { id: "web-dev", q: { fr: "Quelle est son expérience en développement web ?", en: "What is his web development experience?" },
    guide: { fr: "Portfolio V1 (HTML/CSS/JS), SWIM SYNC et le rack SOPP Agents (huit applications avec liens réels).", en: "Portfolio V1 (HTML/CSS/JS), SWIM SYNC and the SOPP Agents rack (eight applications with real links)." }, pointTo: [{ type: "project", id: "portfolio-v1" }] },
  { id: "music", q: { fr: "Quel est son rapport à la musique ?", en: "What is his relationship with music?" },
    guide: { fr: "Pratiques (guitare, piano, MAO, écriture, chant, mix, promotion). Chiffres historiques = à confirmer.", en: "Practices (guitar, piano, DAW, songwriting, vocals, mixing, promotion). Historical figures = to be confirmed." }, pointTo: [{ type: "about" }] },
  { id: "cv", q: { fr: "Peut-on consulter son CV ?", en: "Can I see his CV?" },
    guide: { fr: "Dire si cv.available ; sinon : en cours de mise à jour.", en: "Say whether cv.available; otherwise: being updated." }, pointTo: [{ type: "cv" }] },
  { id: "contact", q: { fr: "Comment le contacter ?", en: "How can I contact him?" },
    guide: { fr: "Uniquement les contacts présents dans `contact`. E-mail non confirmé : ne pas l’afficher.", en: "Only contacts present in `contact`. Unconfirmed e-mail: do not show it." }, pointTo: [{ type: "contact" }] },
  { id: "international", q: { fr: "Est-il disponible pour un poste à l’international ?", en: "Is he available for an international position?" },
    guide: { fr: "Confirmé : disponible à partir de septembre, ouvert à l’étranger. Date exacte non fournie.", en: "Confirmed: available from September, open to working abroad. Exact date not provided." }, pointTo: [{ type: "contact" }] }
];

export function buildKnowledge({ projects = PROJECTS, categories = CATEGORIES, applications = APPLICATIONS, profile = PROFILE } = {}) {
  const categoryIndex = new Map(categories.map(category => [category.id, category]));
  const status = profile.status || {};
  const kbProjects = projects.map(project => buildProject(project, categoryIndex));

  const kb = {
    version: KB_VERSION,
    identity: compact({
      name: profile.name,
      status: {
        level: status.level, graduatingSoon: status.graduatingSoon, degreeTitle: status.degreeTitle,
        institution: status.institution, availableFrom: status.availableFrom, availableFromDate: status.availableFromDate,
        openToInternational: status.openToInternational
      },
      headline: bilingual(profile.headline),
      availability: bilingual(profile.availabilityLine)
    }),
    skillGroups: (profile.skillGroups || []).map(group => compact({
      id: group.id, name: bilingual(group), items: { fr: group.items?.fr, en: group.items?.en }
    })),
    education: (profile.education || []).map(item => compact({
      id: item.id, status: statusOf(item), level: item.level, title: bilingual(item.title), institution: item.institution, years: item.years
    })),
    experience: (profile.experience || []).map(item => compact({
      id: item.id, status: statusOf(item), kind: item.kind, year: item.year, organisation: item.organisation,
      location: item.location, title: bilingual(item.title), assignments: "not provided"
    })),
    music: compact({
      practices: { fr: profile.music?.practices?.fr, en: profile.music?.practices?.en },
      historical: profile.music?.historical ? {
        status: statusOf(profile.music.historical), yearsOfPractice: profile.music.historical.yearsOfPractice,
        streamsOrUses: profile.music.historical.streamsOrUses
      } : undefined,
      projects: (profile.music?.projects || []).map(item => ({
        id: item.id, name: item.name, status: statusOf(item), note: bilingual(item.note)
      }))
    }),
    cv: compact({ available: Boolean(profile.cv?.url), url: profile.cv?.url, fileName: profile.cv?.url ? profile.cv.fileName : undefined, updated: profile.cv?.updated }),
    contact: compact({
      email: profile.contact?.email,
      links: (profile.contact?.links || []).filter(link => link.url).map(link => ({ id: link.id, label: link.label, url: link.url })),
      previousPortfolio: profile.portfolioV1,
      applicationsHub: profile.applicationsHub
    }),
    categories: categories.map(category => compact({
      id: category.id, name: bilingual(category),
      projectIds: projects.filter(project => project.categories?.[0] === category.id).map(project => project.id),
      alsoTaggedProjectIds: projects.filter(project => project.categories?.includes(category.id) && project.categories[0] !== category.id).map(project => project.id)
    })),
    projects: kbProjects,
    applications: applications.map(app => compact({
      id: app.id, name: app.name, category: bilingual(app.category), description: bilingual(app.description), url: app.url, repository: app.repository
    })),
    caveats: [
      { id: "no-ranking", fr: "Les projets ne sont pas hiérarchisés : tous sont au même niveau.", en: "Projects are not ranked: all are on equal footing." },
      { id: "provisional-artwork", fr: "Les pochettes 3D sont des visuels provisoires générés pour la boutique, pas les livrables définitifs.", en: "The 3D sleeves are provisional artwork generated for the store, not the final deliverables." },
      { id: "fictional-decor", fr: "Affiches, stickers et pochettes décoratives de la boutique sont des éléments fictifs de décor, pas des réalisations d’Adam.", en: "Posters, stickers and decorative sleeves in the shop are fictional decor, not work by Adam." },
      { id: "historical-sources", fr: "Une partie des textes vient de l’ancien portfolio ; les rôles individuels signalés « à préciser » ne sont pas confirmés.", en: "Part of the text comes from the previous portfolio; individual roles flagged “to be confirmed” are not confirmed." }
    ],
    notProvided: buildNotProvided(profile, projects),
    faq: FAQ_ANCHORS.map(item => compact({ id: item.id, question: item.q, guide: item.guide, pointTo: item.pointTo }))
  };
  kb.actionTargets = buildActionTargets(kb);
  return kb;
}

export function buildActionTargets(kb) {
  return [
    ...kb.projects.map(project => ({ type: "project", id: project.id })),
    ...kb.applications.map(app => ({ type: "app", id: app.id })),
    { type: "cv" }, { type: "contact" }, { type: "about" }
  ];
}

let defaultKnowledge = null;
export function getDefaultKnowledge() {
  if (!defaultKnowledge) defaultKnowledge = buildKnowledge();
  return defaultKnowledge;
}

export const KNOWN_ACTION_TARGETS = Object.freeze(getDefaultKnowledge().actionTargets);

export function isKnownActionTarget(type, id, targets = KNOWN_ACTION_TARGETS) {
  return targets.some(target => target.type === type && (target.id === undefined ? id === undefined : target.id === id));
}

// ---------------------------------------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------------------------------------

function pick(value, lang) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (lang === "both") {
    const fr = value.fr, en = value.en;
    if (Array.isArray(fr) || Array.isArray(en)) return `FR: ${(fr || []).join("; ")} | EN: ${(en || []).join("; ")}`;
    if (fr && en && fr !== en) return `FR: ${fr} | EN: ${en}`;
    return fr || en || "";
  }
  const chosen = value[lang] ?? value.fr ?? value.en;
  return Array.isArray(chosen) ? chosen.join("; ") : chosen || "";
}

/**
 * Renders the KB as markdown for the model's context. `lang` = "fr" | "en" | "both" (default "both").
 * The worker passes the visitor's language to halve the token count; the model still answers in the visitor's language.
 */
export function renderKnowledgeForPrompt(kb, { lang = "both" } = {}) {
  const L = ["fr", "en", "both"].includes(lang) ? lang : "both";
  const out = [];
  const line = (text) => { if (text) out.push(text); };

  line("# KNOWLEDGE BASE (trusted, read-only data about Adam Soppelsa)");
  line(`Language of the texts below: ${L === "both" ? "French and English" : L === "fr" ? "French" : "English"}. Status "confirmed" = validated by Adam. Status "historical-unconfirmed" = taken from his previous portfolio and still to be confirmed.`);

  const id = kb.identity || {};
  line("\n## Identity");
  line(`- Name: ${id.name}`);
  const s = id.status || {};
  line(`- Status (confirmed): ${s.level}${s.graduatingSoon ? ", graduating soon" : ""}`);
  line(`- Degree title: ${s.degreeTitle || "NOT PROVIDED"}; institution: ${s.institution || "NOT PROVIDED"}`);
  line(`- Availability (confirmed): from ${s.availableFrom || "NOT PROVIDED"}${s.availableFromDate ? ` (${s.availableFromDate})` : " — exact date NOT PROVIDED"}; open to working abroad: ${s.openToInternational ? "yes" : "unknown"}`);
  line(`- Headline: ${pick(id.headline, L)}`);

  line("\n## Skill families (derived from the validated project sheets; no tools/software confirmed)");
  for (const group of kb.skillGroups || []) line(`- ${pick(group.name, L)}: ${pick(group.items, L)}`);

  line("\n## Education and experience (status flags matter)");
  for (const item of kb.education || []) line(`- [${item.status}] ${pick(item.title, L)}${item.institution ? ` — ${item.institution}` : ""}`);
  for (const item of kb.experience || []) line(`- [${item.status}] ${pick(item.title, L)} ${item.year || ""} — ${item.organisation}${item.location ? `, ${item.location}` : ""} (assignments: not provided)`);

  line("\n## Music");
  if (kb.music?.practices) line(`- Practices: ${pick(kb.music.practices, L)}`);
  if (kb.music?.historical) line(`- [${kb.music.historical.status}] Years of practice: ${kb.music.historical.yearsOfPractice ?? "n/a"}; streams/uses: ${kb.music.historical.streamsOrUses ?? "n/a"}`);
  for (const item of kb.music?.projects || []) line(`- [${item.status}] Music project: ${item.name}${item.note ? ` — ${pick(item.note, L)}` : ""}`);

  line("\n## CV and contact");
  line(`- CV downloadable now: ${kb.cv?.available ? `yes (${kb.cv.fileName})` : "no — being updated"}`);
  line(`- E-mail: ${kb.contact?.email || "NOT PROVIDED"}`);
  for (const link of kb.contact?.links || []) line(`- ${link.label}: ${link.url}`);
  if (kb.contact?.previousPortfolio) line(`- Previous portfolio (V1): ${kb.contact.previousPortfolio}`);

  line("\n## Categories (physical bins in the store)");
  for (const category of kb.categories || []) line(`- ${category.id}: ${pick(category.name, L)} — records: ${(category.projectIds || []).join(", ") || "none"}${category.alsoTaggedProjectIds ? ` (also tagged: ${category.alsoTaggedProjectIds.join(", ")})` : ""}`);

  line(`\n## Projects (${kb.projects.length}; all on equal footing — never rank them). Pointer ids in brackets.`);
  for (const project of kb.projects) {
    line(`\n### [project:${project.id}] ${pick(project.title, L)}${project.year ? ` (${project.year})` : ""}`);
    line(`- Categories: ${(project.categories || []).map(category => pick(category, L)).join(" / ")}`);
    line(`- Work mode: ${project.workMode}${project.collaborators ? `; with: ${project.collaborators.join(", ")}` : ""}`);
    line(`- Summary: ${pick(project.summary, L)}`);
    line(`- Context: ${pick(project.context, L)}`);
    line(`- Challenge: ${pick(project.challenge, L)}`);
    line(`- Role (as documented): ${pick(project.role, L)}`);
    line(`- Work: ${pick(project.work, L)}`);
    line(`- Skills: ${pick(project.skills, L)}`);
    line(`- Outcome: ${pick(project.outcome, L)}`);
  }

  line("\n## Web applications rack: SOPP Agents (real, live links)");
  for (const app of kb.applications || []) line(`- [app:${app.id}] ${app.name} — ${pick(app.category, L)} — ${pick(app.description, L)} — ${app.url}`);

  line("\n## Caveats");
  for (const item of kb.caveats || []) line(`- ${pick(item, L)}`);

  line("\n## NOT PROVIDED (say you don't have it; never guess)");
  for (const item of kb.notProvided || []) line(`- ${pick(item, L)}`);

  line("\n## Recruiter question anchors (guidance on where to look; not scripted answers)");
  for (const item of kb.faq || []) line(`- ${pick(item.question, L)} → ${pick(item.guide, L)}`);

  line("\n## Valid pointer markers\n[[about]] [[cv]] [[contact]] " + (kb.projects || []).map(p => `[[project:${p.id}]]`).join(" ") + " " + (kb.applications || []).map(a => `[[app:${a.id}]]`).join(" "));
  return out.join("\n");
}
