// Local, deterministic fallback for the shopkeeper ("catalogue mode").
// It answers ONLY from the knowledge base (src/data/knowledge.js). It is not an AI and the UI must not present it as one.
//
//   answerLocally(question, { language, kb }) -> { reply, actions:[{type,id?}], intent, language }

import { getDefaultKnowledge } from "../data/knowledge.js";

export const NOT_IN_COLLECTION = {
  fr: "Je n'ai pas encore cette information dans ma collection. Le mieux est de contacter Adam directement.",
  en: "I don't have that information in my collection yet. The best thing is to contact Adam directly."
};
export const NOT_IN_COLLECTION_SHORT = {
  fr: "Je n'ai pas encore cette information dans ma collection.",
  en: "I don't have that information in my collection yet."
};

export const STARTER_QUESTIONS = {
  fr: ["Présente-moi Adam et son parcours.", "Quel était son rôle dans ExpoData ?", "Est-il disponible pour un poste à l'international ?"],
  en: ["Introduce Adam and his background.", "What was his role in ExpoData?", "Is he available for an international position?"]
};

// Extra search words per known project id. Unknown (future) projects still match through their own titles.
const PROJECT_ALIASES = {
  rapmap: ["rapmap", "rap map", "el nuevo podcast", "podcast"],
  "winehouse-promo": ["post de promotion winehouse", "promotion winehouse", "post winehouse", "winehouse promo", "winehouse promotional post", "post de promotion"],
  wero: ["wero", "paylib"],
  "student-housing": ["logement etudiant", "logement etudiant bordelais", "student housing", "housing"],
  "winehouse-amy": ["winehouse amy", "amy", "reedition", "reissue"],
  smac: ["smac", "diffuser", "aides a la creation", "krakatoa", "rocher de palmer", "rock school", "scenes de musiques actuelles", "inconnue"],
  "jugar-si-quieres": ["jugarsiquieres", "jugar si quieres", "jugar"],
  "swim-sync": ["swim sync", "swimsync", "piscine interactive", "pocl", "hackathon"],
  expodata: ["expodata", "expo data", "vernissage"],
  "portfolio-v1": ["portfolio v1", "portfolio v 1", "ancien portfolio", "old portfolio", "premier portfolio", "first portfolio", "previous portfolio"]
};

export const norm = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function hasPhrase(text, phrase) {
  const padded = ` ${text} `;
  return padded.includes(` ${phrase} `) || padded.includes(` ${phrase} s `) || padded.includes(` ${phrase}s `);
}

export function detectLanguage(text, fallback = "fr") {
  const raw = String(text || "");
  const t = ` ${norm(raw)} `;
  const fr = [" le ", " la ", " les ", " un ", " une ", " des ", " est ", " quel ", " quelle ", " quels ", " quelles ", " comment ", " peux ", " qui ", " pour ", " dans ", " avec ", " son ", " sa ", " ses ", " et ", " il ", " que ", " est il ", " parcours ", " projets ", " competences "];
  const en = [" the ", " is ", " are ", " what ", " who ", " how ", " can ", " does ", " his ", " he ", " for ", " with ", " and ", " of ", " about ", " tell ", " me ", " project ", " projects ", " skills ", " experience ", " was "];
  let score = /[àâçéèêëîïôùûœ]/i.test(raw) ? 1.5 : 0;
  for (const word of fr) if (t.includes(word)) score += 1;
  for (const word of en) if (t.includes(word)) score -= 1;
  return score > 0 ? "fr" : score < 0 ? "en" : fallback;
}

const pick = (value, lang) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const chosen = value[lang] ?? value.fr ?? value.en;
  return Array.isArray(chosen) ? chosen : chosen || "";
};
const shortTitle = (project, lang) => String(pick(project.title, lang)).split(/\s+[—–-]\s+/)[0];
const list = (items, lang) => {
  const and = lang === "fr" ? " et " : " and ";
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
};

// ---- matching ------------------------------------------------------------------------------------------------

function projectAliases(project) {
  const set = new Set(PROJECT_ALIASES[project.id] || []);
  set.add(norm(project.id.replace(/-/g, " ")));
  for (const lang of ["fr", "en"]) {
    const base = norm(String(project.title?.[lang] || "").split(/\s+[—–-]\s+/)[0]);
    if (base.length >= 4) set.add(base);
  }
  return [...set].filter(Boolean);
}

export function matchProjects(text, kb) {
  const t = norm(text);
  const scored = [];
  for (const project of kb.projects) {
    let best = 0;
    for (const alias of projectAliases(project)) if (hasPhrase(t, alias)) best = Math.max(best, alias.length);
    if (best) scored.push({ project, score: best });
  }
  if (!scored.length && /\bwinehouse\b/.test(t)) {
    for (const project of kb.projects) if (project.id.startsWith("winehouse")) scored.push({ project, score: 1 });
  }
  if (!scored.length) return [];
  const top = Math.max(...scored.map(item => item.score));
  return scored.filter(item => item.score === top).map(item => item.project);
}

export function matchApplications(text, kb) {
  const t = norm(text);
  return kb.applications.filter(app => hasPhrase(t, norm(app.name)) || hasPhrase(t, norm(app.id)));
}

// ---- reply builders ------------------------------------------------------------------------------------------

function workModeLine(project, lang) {
  if (project.workMode === "collaborative") {
    const who = project.collaborators?.length ? list(project.collaborators, lang) : "";
    return lang === "fr" ? `Travail collectif${who ? `, avec ${who}` : ""}.` : `Collaborative work${who ? `, with ${who}` : ""}.`;
  }
  if (project.workMode === "personal") return lang === "fr" ? "Projet personnel." : "Personal project.";
  return "";
}

function projectReply(project, lang, wantsRole) {
  const title = pick(project.title, lang);
  const work = pick(project.work, lang) || [];
  const mode = workModeLine(project, lang);
  const role = pick(project.role, lang);
  const lines = [];
  if (wantsRole) {
    lines.push(lang === "fr" ? `${title}. Rôle documenté : ${role}` : `${title}. Documented role: ${role}`);
    if (mode) lines.push(mode);
    if (work.length) lines.push((lang === "fr" ? "Dans le détail : " : "In detail: ") + work.slice(0, 4).join(" ; ") + ".");
  } else {
    lines.push(`${title}${project.year ? ` (${project.year})` : ""}. ${pick(project.summary, lang)}`);
    const context = pick(project.context, lang);
    if (context) lines.push(context);
    if (work.length) lines.push((lang === "fr" ? "Au programme : " : "What it involved: ") + work.slice(0, 3).join(" ; ") + ".");
    lines.push(lang === "fr" ? `Rôle : ${role}` : `Role: ${role}`);
    if (mode) lines.push(mode);
  }
  lines.push(lang === "fr" ? "Va jeter un œil au vinyle correspondant pour la fiche complète." : "Go and have a look at the matching record for the full sheet.");
  return lines.join("\n");
}

function applicationReply(app, lang) {
  return [
    `${app.name} — ${pick(app.category, lang)}. ${pick(app.description, lang)}`,
    `${lang === "fr" ? "Application" : "Live app"} : ${app.url}`,
    `${lang === "fr" ? "Dépôt GitHub" : "GitHub repository"} : ${app.repository}`
  ].join("\n");
}

const INTENTS = [
  ["degree", /(master|\bm2\b|diplome|degree|etablissement|institution|universit|ecole|school|college|intitule|graduat)/],
  ["cv", /(\bcv\b|curriculum|\bresume\b|telecharg|download)/],
  ["contact", /(contact|joindre|ecrire|reach|e-?mail|\bmail\b|courriel|linkedin|instagram|reseaux|social|telephone|phone|numero)/],
  ["availability", /(disponib|availab|international|etranger|abroad|overseas|relocat|embauch|septembre|september|quand|\bwhen\b|start date|demarr|commenc)/]
];

const LATE_INTENTS = [
  ["webdev", /(developpement web|web dev|developpeur|developer|front ?end|html|css|javascript|\bcode\b|coder|programm|integration|site web|website)/],
  ["apps", /(application|\bapps?\b|\brack\b|sopp agents|outils|\btools?\b|tester|\btest\b)/],
  ["music", /(musi|guitar|piano|\bchant|\bmao\b|\bmix\b|\bsing|\bsong|stream|\bdaw\b|compos)/],
  ["experience", /(experience|\bstages?\b|stagiaire|internship|professionnel|emploi|\bjob\b|travaille|worked|work history|employeur|entreprise|company|bmw|lifestyle)/],
  ["best", /(meilleur|plus interessant|\bbest\b|most interesting|favori|favorite|recommand|conseill|suggest|par ou commencer|where to start|commencer)/],
  ["skills", /(competence|\bskills?\b|savoir faire|sait faire|maitrise|expertise|capable|strengths|\bforces?\b|can he do)/],
  ["categories", /(categorie|\brayons?\b|\bbacs?\b|\bbins?\b|\bcategor|shelves|domaines|areas)/],
  ["background", /(parcours|formation|etudes|background|education|career|cursus)/],
  ["who", /(qui est|who is|\bwho\b|presente|introduce|tell me about|a propos|about adam|qui es)/],
  ["greeting", /^(salut|bonjour|bonsoir|hello|hi|hey|coucou)\b/]
];

export function detectIntent(text, kb) {
  const t = norm(text);
  for (const [name, pattern] of INTENTS) if (pattern.test(t)) return { name };
  const projects = matchProjects(text, kb);
  if (projects.length) return { name: "project", projects };
  const apps = matchApplications(text, kb);
  if (apps.length) return { name: "application", apps };
  for (const [name, pattern] of LATE_INTENTS) if (pattern.test(t)) return { name };
  return { name: "unknown" };
}

export function answerLocally(question, { language = "fr", kb = getDefaultKnowledge() } = {}) {
  const lang = detectLanguage(question, language === "en" ? "en" : "fr");
  const t = norm(question);
  const intent = detectIntent(question, kb);
  const id = kb.identity || {};
  const status = id.status || {};
  const nic = NOT_IN_COLLECTION[lang];
  const nicShort = NOT_IN_COLLECTION_SHORT[lang];
  const fr = lang === "fr";
  let reply = "";
  let actions = [];

  switch (intent.name) {
    case "project": {
      const wantsRole = /(role|responsab|contribu|fait quoi|did he|his part|part in|charge|mission)/.test(t);
      const projects = intent.projects.slice(0, 2);
      reply = projects.map(project => projectReply(project, lang, wantsRole)).join("\n\n");
      actions = projects.map(project => ({ type: "project", id: project.id }));
      break;
    }
    case "application": {
      reply = intent.apps.slice(0, 2).map(app => applicationReply(app, lang)).join("\n\n");
      actions = intent.apps.slice(0, 2).map(app => ({ type: "app", id: app.id }));
      break;
    }
    case "degree": {
      reply = fr
        ? `Adam prépare un ${status.level || "Master 2"} et sera bientôt diplômé. ${nic} (L'intitulé exact et l'établissement ne sont pas encore renseignés.)`
        : `Adam is working on a ${status.level || "Master's 2"} and will graduate soon. ${nic} (The exact title and institution have not been provided yet.)`;
      actions = [{ type: "about" }];
      break;
    }
    case "cv": {
      reply = kb.cv?.available
        ? (fr ? "Son CV est posé sur le comptoir, au format PDF : clique sur le dossier pour le télécharger." : "His CV is on the counter as a PDF: click the folder to download it.")
        : (fr ? "Le CV n'est pas encore téléchargeable : il est en cours de mise à jour. Dès que le fichier sera ajouté, il sera dans le dossier posé sur le comptoir."
              : "The CV isn't downloadable yet: it is being updated. As soon as the file is added it will be in the folder on the counter.");
      actions = [{ type: "cv" }];
      break;
    }
    case "contact": {
      const links = kb.contact?.links || [];
      const parts = [];
      const asksMail = /(e-?mail|\bmail\b|courriel|adresse|address)/.test(t);
      if (kb.contact?.email) parts.push(`E-mail${fr ? " :" : ":"} ${kb.contact.email}`);
      else if (asksMail) parts.push(fr ? `${nicShort} L'adresse e-mail n'est pas encore configurée.` : `${nicShort} The e-mail address isn't configured yet.`);
      else parts.push(fr ? "L'adresse e-mail d'Adam n'est pas encore configurée dans ma collection." : "Adam's e-mail address isn't configured in my collection yet.");
      if (links.length) parts.push(links.map(link => `${link.label} : ${link.url}`).join("\n"));
      parts.push(fr ? "D'autres liens (LinkedIn, Instagram, plateformes musicales) seront ajoutés dès qu'ils seront confirmés." : "More links (LinkedIn, Instagram, music platforms) will be added once confirmed.");
      reply = parts.join("\n");
      actions = [{ type: "contact" }];
      break;
    }
    case "availability": {
      reply = fr
        ? `Oui : Adam est ouvert à travailler à l'étranger et disponible à partir de septembre. Pour la date exacte, je n'ai pas encore cette information dans ma collection.`
        : `Yes: Adam is open to working abroad and available from September. For the exact date, I don't have that information in my collection yet.`;
      actions = [{ type: "contact" }];
      break;
    }
    case "webdev": {
      const names = kb.applications.map(app => app.name);
      reply = fr
        ? `Côté web : le Portfolio V1 (HTML, CSS, JavaScript, bilingue), SWIM SYNC (objet connecté alimenté par des données ouvertes ; la répartition individuelle reste à préciser) et le rack SOPP Agents, avec ${names.length} applications en ligne : ${list(names, lang)}. Je n'ai pas de liste de technologies confirmée au-delà de HTML, CSS et JavaScript.`
        : `On the web side: Portfolio V1 (HTML, CSS, JavaScript, bilingual), SWIM SYNC (a connected object fed by open data; the individual split still needs confirming) and the SOPP Agents rack with ${names.length} live applications: ${list(names, lang)}. I don't have a confirmed technology list beyond HTML, CSS and JavaScript.`;
      actions = [{ type: "project", id: "portfolio-v1" }, { type: "project", id: "swim-sync" }];
      break;
    }
    case "apps": {
      reply = (fr ? "Le rack SOPP Agents réunit des applications en ligne que tu peux ouvrir :\n" : "The SOPP Agents rack holds live applications you can open:\n") +
        kb.applications.map(app => `• ${app.name} — ${pick(app.category, lang)}`).join("\n");
      break;
    }
    case "music": {
      const practices = pick(kb.music?.practices, lang) || [];
      const hist = kb.music?.historical;
      const names = (kb.music?.projects || []).filter(item => item.status !== "confirmed").map(item => item.name);
      reply = fr
        ? `La musique fait partie de son identité : ${list(practices, lang)}. Il y a aussi son album personnel « Winehouse », qui a son propre post promotionnel.${hist ? ` D'après l'ancien portfolio (à confirmer) : environ ${hist.yearsOfPractice} ans de pratique et ${hist.streamsOrUses} de streams ou d'utilisations${names.length ? `, avec ${list(names, lang)}` : ""}${names.length && /\.$/.test(names[names.length - 1]) ? "" : "."}` : ""}`
        : `Music is part of his identity: ${list(practices, lang)}. There is also his personal album "Winehouse", which has its own promotional post.${hist ? ` According to his previous portfolio (still to be confirmed): about ${hist.yearsOfPractice} years of practice and ${hist.streamsOrUses} streams or uses${names.length ? `, including ${list(names, lang)}` : ""}${names.length && /\.$/.test(names[names.length - 1]) ? "" : "."}` : ""}`;
      actions = [{ type: "project", id: "winehouse-promo" }, { type: "about" }];
      break;
    }
    case "experience": {
      const entries = (kb.experience || []).map(item => `${item.year} — ${item.organisation}${item.location ? ` (${item.location})` : ""}`);
      reply = fr
        ? `D'après l'ancien portfolio (à confirmer avant publication) : ${list(entries, lang)}, en stage. Pour le détail des missions, je n'ai pas encore cette information dans ma collection. Pour voir son travail concret, les dix vinyles des bacs sont le meilleur point de départ.`
        : `According to his previous portfolio (still to be confirmed): ${list(entries, lang)}, as internships. For the details of the assignments, I don't have that information in my collection yet. To see concrete work, the ten records in the bins are the best place to start.`;
      actions = [{ type: "about" }];
      break;
    }
    case "best": {
      const lines = kb.categories.map(category => {
        const titles = (category.projectIds || []).map(pid => shortTitle(kb.projects.find(project => project.id === pid), lang));
        return titles.length ? `• ${pick(category.name, lang)} : ${titles.join(", ")}` : null;
      }).filter(Boolean);
      reply = (fr ? "Je ne les classe pas : les dix projets sont au même niveau. Dis-moi ce qui t'intéresse, ou fouille un bac :\n" : "I don't rank them: all ten projects are on equal footing. Tell me what interests you, or dig through a bin:\n") + lines.join("\n");
      break;
    }
    case "skills": {
      const names = kb.skillGroups.map(group => pick(group.name, lang));
      reply = fr
        ? `Ses compétences se regroupent en ${names.length} familles : ${list(names, lang)}. Elles viennent des fiches projet validées ; je n'ai pas de liste de logiciels ou d'outils confirmée.`
        : `His skills fall into ${names.length} families: ${list(names, lang)}. They come from the validated project sheets; I don't have a confirmed list of software or tools.`;
      actions = [{ type: "about" }];
      break;
    }
    case "categories": {
      reply = (fr ? "Six bacs dans la boutique :\n" : "Six bins in the shop:\n") + kb.categories.map(category => `• ${pick(category.name, lang)}`).join("\n");
      break;
    }
    case "background": {
      reply = fr
        ? `Adam est en ${status.level || "Master 2"}, bientôt diplômé. Pour l'intitulé exact et l'établissement, je n'ai pas encore cette information dans ma collection. D'après son ancien portfolio (à confirmer) : un BUT Information numérique dans les organisations, puis des stages en 2023 et 2024. La musique fait aussi partie de son parcours.`
        : `Adam is in his ${status.level || "Master's 2"}, graduating soon. For the exact title and institution, I don't have that information in my collection yet. According to his previous portfolio (still to be confirmed): a BUT degree in Digital Information in Organisations, then internships in 2023 and 2024. Music is also part of his story.`;
      actions = [{ type: "about" }];
      break;
    }
    case "who": {
      reply = fr
        ? `Adam Soppelsa — ${pick(id.headline, lang)} Ici, chaque projet est un vinyle rangé dans l'un des six bacs. Tu veux que je te guide vers un domaine précis ?`
        : `Adam Soppelsa — ${pick(id.headline, lang)} Here, every project is a record filed in one of six bins. Want me to point you to a specific area?`;
      actions = [{ type: "about" }];
      break;
    }
    case "greeting": {
      reply = fr ? "Bienvenue chez SIDE A ! Je peux te parler du parcours d'Adam, de ses projets, de ses applications ou de sa musique. Par où veux-tu commencer ?"
                 : "Welcome to SIDE A! I can tell you about Adam's background, projects, applications or music. Where would you like to start?";
      break;
    }
    default: {
      reply = `${nic} ` + (fr ? "Je peux te parler de son parcours, de ses projets, de ses applications, de sa musique, de son CV ou de ses contacts."
                              : "I can tell you about his background, projects, applications, music, CV or contact details.");
    }
  }
  return { reply, actions, intent: intent.name, language: lang };
}
