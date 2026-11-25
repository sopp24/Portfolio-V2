
import * as THREE from "three";
import { PROJECTS, CATEGORIES, PROFILE } from "./data/projects.js";
import { APPLICATIONS } from "./data/applications.js";
import { createStoreScene } from "./scene/store.js";
import { createCameraController } from "./controls/camera.js";
import { createRecordInteraction } from "./scene/record-interaction.js";
import { createStoreAudio } from "./audio/store-audio.js";

const $ = (id) => document.getElementById(id);

const COPY = {
  fr: {
    closed: "FERMÉ",
    opened: "OUVERT",
    introEyebrow: "DISQUAIRE INDÉPENDANT  /  BORDEAUX, FRANCE",
    introTitle: "ADAM SOPPELSA",
    introSub: "PROJECTS STORE",
    introText: "Un portfolio à explorer comme une collection. Prends le temps de fouiller les bacs.",
    enter: "OUVRIR LA BOUTIQUE",
    direct: "ALLER DIRECTEMENT AUX PROJETS",
    limited: "CONSULTER LA COLLECTION EN 2D",
    hint: "Déplace la souris pour regarder · vise un vinyle ou une application et clique · molette pour zoomer · Échap pour le menu",
    headerEyebrow: "SIDE A  /  PROJECTS STORE",
    recenter: "RECENTRER",
    gyroOn: "ACTIVER LE GYROSCOPE",
    gyroOff: "DÉSACTIVER LE GYROSCOPE",
    browse2d: "COLLECTION 2D",
    close: "FERMER",
    directoryTitle: "LA COLLECTION",
    directorySub: "Projets & applications",
    allCategories: "Toutes les catégories",
    projects: "PROJETS",
    applications: "APPLICATIONS WEB",
    backToStore: "RETOUR À LA BOUTIQUE",
    openProject: "EXPLORER LE PROJET",
    context: "CONTEXTE",
    challenge: "ENJEU",
    role: "CONTRIBUTION",
    work: "TRAVAIL RÉALISÉ",
    skills: "COMPÉTENCES",
    collaborators: "COLLABORATIONS",
    outcome: "LIVRABLE / RÉSULTAT",
    provisional: "VISUEL PROVISOIRE",
    noYear: "ANNÉE À CONFIRMER",
    appOpen: "OUVRIR L’APPLICATION",
    repoOpen: "DÉPÔT GITHUB",
    gyroOk: "Gyroscope activé.",
    gyroError: "Gyroscope indisponible ou autorisation refusée.",
    introReturn: "Content de te revoir. La collection t’attend.",
    webglError: "La 3D n’est pas disponible sur cet appareil. La collection reste consultable en 2D.",
    projectFallback: "Les pochettes sont des visuels provisoires. Les créations définitives seront ajoutées ensuite.",
    hoverPrompt: "REGARDER PUIS CLIQUER POUR SORTIR LE VINYLE",
    panelEyebrow: "SIDE A / PRESSAGE SÉLECTIONNÉ",
    selectedPrompt: "VINYLE EXTRAIT · MANIPULEZ LA POCHETTE",
    returningPrompt: "REMISE EN RAYON EN COURS…",
    flip: "VOIR LE VERSO",
    showFront: "REVENIR AU RECTO",
    openSleeve: "OUVRIR LA POCHETTE",
    closeSleeve: "REFERMER LA POCHETTE",
    details: "FICHE DU PROJET",
    returnRecord: "REMETTRE DANS LE BAC",
    appPanelEyebrow: "SOPP AGENTS / APPLICATION WEB",
    appHoverPrompt: "REGARDER PUIS CLIQUER POUR CONSULTER",
    appSelectedPrompt: "APPLICATION SÉLECTIONNÉE · LIENS EXTERNES",
    returnApp: "RETOUR AU RACK",
    exitStore: "QUITTER LA BOUTIQUE",
    collectibleName: "BILLET D’OR",
    collectiblePrompt: "UN BILLET RARE EST CACHÉ SUR UN RAYON… CLIQUE POUR LE RÉCUPÉRER",
    collectibleButton: "RÉCUPÉRER LE BILLET D’OR ↗",
    collectibleTitle: "LE BILLET D’OR EST À TOI.",
    collectibleText: "Tu as trouvé le Golden Pass de SIDE A. Une pièce cachée du magasin, à garder comme souvenir de ta visite.",
    collectibleFoundToast: "GOLDEN PASS DÉCOUVERT — 1 / 1",
    leavingToast: "À BIENTÔT CHEZ SIDE A.",
    soundOn: "SON : ON",
    soundOff: "SON : OFF",
    soundUnavailable: "AUDIO INDISPONIBLE",
    listeningButton: "ÉCOUTER",
    listeningTitle: "LA PLATINE EST À TOI.",
    listeningReady: "LECTURE YOUTUBE PRÊTE",
    listeningMissing: "AUCUN TITRE YOUTUBE CONFIGURÉ",
    listeningMissingCopy: "Aucun titre YouTube n’est encore associé à cette platine. Un identifiant vidéo pourra être ajouté dans la balise youtube-video-id du fichier index.html.",
    listeningReadyCopy: "Choisis un titre et lance la lecture avec les commandes YouTube. La vidéo ne démarre jamais automatiquement.",
    listeningFootnote: "La lecture est lancée uniquement à la demande. Le son d’ambiance reste indépendant.",
    easterName: "UN PETIT SECRET",
    easterPrompt: "UN PETIT OBJET SE CACHE SUR LE COMPTOIR… CLIQUE POUR LE DÉCOUVRIR",
    easterButton: "DÉCOUVRIR LE SECRET ↗",
    easterToast: "SIDE A CLUB — GOOD MUSIC, GOOD PEOPLE, ALWAYS.",
    posterPrompt: "VISE UNE AFFICHE ET CLIQUE POUR LA CONSULTER",
    posterEyebrow: "SIDE A / AFFICHE DU MAGASIN",
    posterNoteTitle: "À PROPOS DE CETTE AFFICHE",
    posterNote: "Visuel décoratif fictif créé pour l’univers du disquaire SIDE A. Il ne représente pas un événement réel ni un projet client.",
    shopkeeperName: "LE DISQUAIRE",
    shopkeeperPrompt: "VISE LE DISQUAIRE ET CLIQUE POUR DISCUTER",
    talkToShopkeeper: "PARLER AU DISQUAIRE ↗",
    assistantTitle: "PARLONS MUSIQUE ET PROJETS.",
    assistantStatusOnline: "ASSISTANT IA CONFIGURÉ",
    assistantStatusOffline: "MODE CATALOGUE · IA NON CONNECTÉE",
    assistantWelcome: "Salut, bienvenue chez SIDE A. Je peux te guider à travers les projets d’Adam et les applications qu’il a développées. Qu’est-ce qui t’intéresse ?",
    assistantPlaceholder: "Pose ta question au disquaire…",
    assistantSend: "ENVOYER ↗",
    assistantThinking: "Le disquaire réfléchit…",
    assistantError: "Je n’ai pas réussi à joindre l’assistant. Réessaie dans un instant.",
    assistantOfflinePrefix: "Je fonctionne actuellement en mode catalogue : le serveur IA n’est pas encore configuré. Voici ce que je peux déjà te conseiller :",
    assistantPrompts: ["PRÉSENTE-MOI ADAM", "UN PROJET WEB", "LES APPLICATIONS"],
    assistantQuestions: ["Présente-moi le parcours et les domaines d’Adam.", "Je cherche un projet web ou une application à découvrir.", "Quelles applications puis-je tester ?"]
  },
  en: {
    closed: "CLOSED",
    opened: "OPEN",
    introEyebrow: "INDEPENDENT RECORD STORE  /  BORDEAUX, FRANCE",
    introTitle: "ADAM SOPPELSA",
    introSub: "PROJECTS STORE",
    introText: "A portfolio to explore like a record collection. Take your time and browse the crates.",
    enter: "OPEN THE STORE",
    direct: "GO STRAIGHT TO THE PROJECTS",
    limited: "BROWSE THE 2D COLLECTION",
    hint: "Move the mouse to look · aim at a record or application and click · scroll to zoom · Esc for the menu",
    headerEyebrow: "SIDE A  /  PROJECTS STORE",
    recenter: "RECENTER",
    gyroOn: "ENABLE GYROSCOPE",
    gyroOff: "DISABLE GYROSCOPE",
    browse2d: "2D COLLECTION",
    close: "CLOSE",
    directoryTitle: "THE COLLECTION",
    directorySub: "Projects & applications",
    allCategories: "All categories",
    projects: "PROJECTS",
    applications: "WEB APPLICATIONS",
    backToStore: "BACK TO THE STORE",
    openProject: "EXPLORE PROJECT",
    context: "CONTEXT",
    challenge: "CHALLENGE",
    role: "CONTRIBUTION",
    work: "WHAT I DID",
    skills: "SKILLS",
    collaborators: "COLLABORATORS",
    outcome: "DELIVERABLE / OUTCOME",
    provisional: "PROVISIONAL ARTWORK",
    noYear: "YEAR TO CONFIRM",
    appOpen: "OPEN APPLICATION",
    repoOpen: "GITHUB REPOSITORY",
    gyroOk: "Gyroscope enabled.",
    gyroError: "Gyroscope unavailable or permission denied.",
    introReturn: "Welcome back. The collection is waiting.",
    webglError: "3D is not available on this device. You can still browse the collection in 2D.",
    projectFallback: "Sleeve artwork is provisional. Final project visuals will be added later.",
    hoverPrompt: "LOOK AT A RECORD, THEN CLICK TO PULL IT OUT",
    panelEyebrow: "SIDE A / SELECTED PRESSING",
    selectedPrompt: "RECORD EXTRACTED · HANDLE THE SLEEVE",
    returningPrompt: "RETURNING TO THE CRATE…",
    flip: "VIEW SIDE B",
    showFront: "RETURN TO SIDE A",
    openSleeve: "OPEN THE SLEEVE",
    closeSleeve: "CLOSE THE SLEEVE",
    details: "PROJECT DETAILS",
    returnRecord: "RETURN TO THE CRATE",
    appPanelEyebrow: "SOPP AGENTS / WEB APPLICATION",
    appHoverPrompt: "LOOK AT THE CARD, THEN CLICK TO EXPLORE",
    appSelectedPrompt: "APPLICATION SELECTED · EXTERNAL LINKS",
    returnApp: "BACK TO THE RACK",
    exitStore: "LEAVE THE STORE",
    collectibleName: "GOLDEN PASS",
    collectiblePrompt: "A RARE TICKET IS HIDDEN ON A SHELF… CLICK TO COLLECT IT",
    collectibleButton: "COLLECT THE GOLDEN PASS ↗",
    collectibleTitle: "THE GOLDEN PASS IS YOURS.",
    collectibleText: "You found the SIDE A Golden Pass. A hidden piece of the store to keep as a souvenir of your visit.",
    collectibleFoundToast: "GOLDEN PASS FOUND — 1 / 1",
    leavingToast: "SEE YOU AGAIN AT SIDE A.",
    soundOn: "SOUND: ON",
    soundOff: "SOUND: OFF",
    soundUnavailable: "AUDIO UNAVAILABLE",
    listeningButton: "LISTEN",
    listeningTitle: "THE TURNTABLE IS YOURS.",
    listeningReady: "YOUTUBE PLAYER READY",
    listeningMissing: "NO YOUTUBE TRACK CONFIGURED",
    listeningMissingCopy: "No YouTube track is linked to this turntable yet. Add a video ID to the youtube-video-id meta tag in index.html when a track is selected.",
    listeningReadyCopy: "Choose a track and start playback with the YouTube controls. Playback never starts automatically.",
    listeningFootnote: "Playback starts only when requested. Ambient sound is independent.",
    easterName: "A LITTLE SECRET",
    easterPrompt: "A LITTLE OBJECT IS HIDING ON THE COUNTER… CLICK TO DISCOVER IT",
    easterButton: "DISCOVER THE SECRET ↗",
    easterToast: "SIDE A CLUB — GOOD MUSIC, GOOD PEOPLE, ALWAYS.",
    posterPrompt: "LOOK AT A POSTER AND CLICK TO EXPLORE IT",
    posterEyebrow: "SIDE A / STORE WALL PRINT",
    posterNoteTitle: "ABOUT THIS PRINT",
    posterNote: "Fictional decorative artwork created for the SIDE A record-store setting. It does not represent a real event or client project.",
    shopkeeperName: "THE RECORD STORE CLERK",
    shopkeeperPrompt: "LOOK AT THE CLERK AND CLICK TO CHAT",
    talkToShopkeeper: "TALK TO THE CLERK ↗",
    assistantTitle: "LET’S TALK MUSIC AND PROJECTS.",
    assistantStatusOnline: "AI ASSISTANT CONFIGURED",
    assistantStatusOffline: "CATALOGUE MODE · AI NOT CONNECTED",
    assistantWelcome: "Hey, welcome to SIDE A. I can guide you through Adam’s projects and the applications he has built. What are you curious about?",
    assistantPlaceholder: "Ask the record store clerk…",
    assistantSend: "SEND ↗",
    assistantThinking: "The clerk is thinking…",
    assistantError: "I couldn't reach the assistant. Please try again in a moment.",
    assistantOfflinePrefix: "I'm currently in catalogue mode: the AI server hasn't been configured yet. Here's what I can already recommend:",
    assistantPrompts: ["INTRODUCE ADAM", "A WEB PROJECT", "THE APPLICATIONS"],
    assistantQuestions: ["Introduce Adam’s background and areas of work.", "I’m looking for a web project or an application to explore.", "Which applications can I try?"]
  }
};

let language = "fr";
let store = null;
let cameraController = null;
let recordInteraction = null;
let recordPanelState = { mode: "none" };
let clock = null;
let elapsed = 0;
let isOpen = false;
let directoryVisible = false;
let webglAvailable = false;
let storeAudio = null;
let isTransitioning = false;

function safeStorageGet(key) {
  try { return localStorage.getItem(key); }
  catch (error) { return null; }
}
function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch (error) { console.warn("Local preferences could not be saved.", error); }
}

function makeNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function renderRecordPanel(state = recordPanelState) {
  recordPanelState = state || { mode: "none" };
  const panel = $("record-panel");
  const reticle = $("aim-reticle");
  const hint = $("control-hint");
  const copy = COPY[language];
  const mode = recordPanelState.mode || "none";
  const isApplication = mode === "application-hover" || mode === "application-selected";
  const isShopkeeper = mode === "shopkeeper-hover";
  const isEasterEgg = mode === "easter-hover";
  const isPoster = mode === "poster-hover";
  const isCollectible = mode === "collectible-hover";
  const isHover = mode === "hover" || mode === "application-hover" || isShopkeeper || isEasterEgg || isPoster || isCollectible;
  const isSelected = mode === "selected";
  const isReturning = mode === "returning";
  const visible = isOpen && !directoryVisible;

  reticle.hidden = !visible || isSelected || isReturning || mode === "application-selected";
  reticle.classList.toggle("is-target", isHover);

  if (!visible || mode === "none") {
    panel.hidden = true;
    hint.hidden = !visible;
    return;
  }

  panel.hidden = false;
  panel.classList.toggle("is-hovering", isHover);
  panel.classList.toggle("is-returning", isReturning);
  panel.classList.toggle("is-application", isApplication);

  const project = recordPanelState.project;
  const application = recordPanelState.application;
  const poster = recordPanelState.poster;
  $("record-panel-eyebrow").textContent = isShopkeeper ? "SIDE A / COUNTER SERVICE" : isEasterEgg ? "SIDE A / HIDDEN PRESSING" : isPoster ? copy.posterEyebrow : isCollectible ? "SIDE A / RARE FIND" : isApplication ? copy.appPanelEyebrow : copy.panelEyebrow;
  $("record-title").textContent = isShopkeeper
    ? copy.shopkeeperName
    : isEasterEgg ? copy.easterName
      : isPoster ? (poster?.title?.[language] || "SIDE A")
        : isCollectible ? copy.collectibleName
          : isApplication ? (application?.name || "SOPP AGENTS") : (project?.title?.[language] || "SIDE A");
  $("record-summary").textContent = isShopkeeper
    ? copy.shopkeeperPrompt
    : isEasterEgg ? copy.easterPrompt
      : isPoster ? copy.posterPrompt
        : isCollectible ? copy.collectiblePrompt
          : isApplication
            ? (isHover ? copy.appHoverPrompt : (application?.description?.[language] || copy.appSelectedPrompt))
            : (isHover ? copy.hoverPrompt : isReturning ? copy.returningPrompt : copy.selectedPrompt);

  $("record-actions").hidden = !isSelected;
  $("application-actions").hidden = mode !== "application-selected";
  $("shopkeeper-actions").hidden = !isShopkeeper;
  $("easter-actions").hidden = !isEasterEgg;
  $("collectible-actions").hidden = !isCollectible;
  $("shopkeeper-talk-button").textContent = copy.talkToShopkeeper;
  $("easter-discover-button").textContent = copy.easterButton;
  $("collectible-discover-button").textContent = copy.collectibleButton;

  $("record-flip-button").textContent = recordPanelState.isFlipped ? copy.showFront : copy.flip;
  $("record-open-button").textContent = recordPanelState.isOpen ? copy.closeSleeve : copy.openSleeve;
  $("record-open-button").disabled = !!recordPanelState.isFlipped;
  $("record-details-button").textContent = copy.details;
  $("record-details-button").hidden = !recordPanelState.isOpen;
  $("record-return-button").textContent = copy.returnRecord;

  if (application) {
    $("application-open-link").href = application.url;
    $("application-open-link").textContent = copy.appOpen + " ↗";
    $("application-repo-link").href = application.repository;
    $("application-repo-link").textContent = copy.repoOpen + " ↗";
    $("application-return-button").textContent = copy.returnApp;
  }

  hint.hidden = true;
}

function openPosterDetails(poster) {
  const dialog = $("project-dialog");
  const content = $("project-dialog-content");
  content.replaceChildren();
  content.append(
    makeNode("p", "dialog-eyebrow", COPY[language].posterEyebrow),
    makeNode("h2", "dialog-title", poster?.title?.[language] || "SIDE A"),
    makeNode("p", "dialog-summary", poster?.description?.[language] || "")
  );
  const section = makeNode("section", "dialog-section");
  section.appendChild(makeNode("h3", "dialog-section-title", COPY[language].posterNoteTitle));
  section.appendChild(makeNode("p", "dialog-copy", COPY[language].posterNote));
  content.appendChild(section);
  dialog.showModal();
}

function openProjectDetails(project) {
  const copy = COPY[language];
  const detail = $("project-dialog");
  const content = $("project-dialog-content");
  content.replaceChildren();

  const eyebrow = makeNode("p", "dialog-eyebrow", project.year ? String(project.year) + "  /  " + copy.provisional : copy.noYear + "  /  " + copy.provisional);
  const title = makeNode("h2", "dialog-title", project.title[language]);
  const summary = makeNode("p", "dialog-summary", project.short[language]);
  content.append(eyebrow, title, summary);

  const sections = [
    [copy.context, project.context[language]],
    [copy.challenge, project.challenge[language]],
    [copy.role, project.role[language]],
    [copy.work, project.work[language]],
    [copy.skills, language === "en" ? (project.skillsEn || project.skills) : project.skills],
    [copy.collaborators, project.collaborators],
    [copy.outcome, project.outcome[language]]
  ];

  for (const [heading, value] of sections) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;
    const section = makeNode("section", "dialog-section");
    section.appendChild(makeNode("h3", "dialog-section-title", heading));
    if (Array.isArray(value)) {
      const list = makeNode("ul", "dialog-list");
      value.forEach(item => list.appendChild(makeNode("li", "", item)));
      section.appendChild(list);
    } else {
      section.appendChild(makeNode("p", "dialog-copy", value));
    }
    content.appendChild(section);
  }

  detail.showModal();
}

function renderDirectory() {
  const copy = COPY[language];
  const projectGrid = $("directory-projects");
  const appGrid = $("directory-apps");
  const categorySelect = $("directory-category");
  const selectedCategory = categorySelect.value;

  $("directory-back").hidden = !store;
  $("directory-title").textContent = copy.directoryTitle;
  $("directory-subtitle").textContent = copy.directorySub;
  $("projects-heading").textContent = copy.projects;
  $("applications-heading").textContent = copy.applications;
  $("directory-back").textContent = copy.backToStore;

  categorySelect.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = copy.allCategories;
  categorySelect.appendChild(allOption);
  CATEGORIES.forEach(category => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category[language];
    categorySelect.appendChild(option);
  });
  categorySelect.value = selectedCategory;

  projectGrid.replaceChildren();
  const visibleProjects = PROJECTS.filter(project => !selectedCategory || project.categories.includes(selectedCategory));
  visibleProjects.forEach((project, index) => {
    const card = makeNode("button", "directory-card project-card");
    card.type = "button";
    const artwork = makeNode("span", "directory-artwork");
    artwork.style.background = "linear-gradient(145deg," + project.artwork[0] + "," + project.artwork[1] + " 54%," + project.artwork[2] + ")";
    artwork.appendChild(makeNode("span", "artwork-code", "SIDE A  /  " + String(PROJECTS.indexOf(project) + 1).padStart(2, "0")));
    artwork.appendChild(makeNode("span", "artwork-title", project.title[language]));
    const details = makeNode("span", "directory-card-copy");
    const category = CATEGORIES.find(item => item.id === project.categories[0]);
    details.appendChild(makeNode("span", "directory-card-category", category ? category[language] : ""));
    details.appendChild(makeNode("strong", "directory-card-title", project.title[language]));
    details.appendChild(makeNode("span", "directory-card-summary", project.short[language]));
    card.append(artwork, details);
    card.addEventListener("click", () => openProjectDetails(project));
    projectGrid.appendChild(card);
  });

  appGrid.replaceChildren();
  APPLICATIONS.forEach(app => {
    const card = makeNode("article", "directory-card app-card");
    const stamp = makeNode("span", "app-stamp", "WEB / APP");
    const name = makeNode("h3", "app-card-title", app.name);
    const category = makeNode("p", "directory-card-category", app.category[language]);
    const description = makeNode("p", "directory-card-summary", app.description[language]);
    const links = makeNode("div", "app-card-links");
    const open = makeNode("a", "text-link", copy.appOpen + " ↗");
    open.href = app.url;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    const repo = makeNode("a", "text-link secondary-link", copy.repoOpen + " ↗");
    repo.href = app.repository;
    repo.target = "_blank";
    repo.rel = "noopener noreferrer";
    links.append(open, repo);
    card.append(stamp, name, category, description, links);
    appGrid.appendChild(card);
  });

  $("about-heading").textContent = language === "fr" ? "À PROPOS" : "ABOUT";
  $("about-subtitle").textContent = language === "fr"
    ? "Une sélection de projets, de pratiques et de curiosités."
    : "A selection of projects, practices and curiosities.";
  const profileContent = $("profile-content");
  profileContent.replaceChildren();
  const profileCard = makeNode("article", "directory-card profile-card");
  profileCard.appendChild(makeNode("span", "app-stamp", "SIDE A  /  PROFILE"));
  profileCard.appendChild(makeNode("h3", "app-card-title", PROFILE.name));
  profileCard.appendChild(makeNode("p", "directory-card-summary", language === "fr"
    ? "Création numérique, stratégie, communication, design et développement d’expériences web."
    : "Digital creation, strategy, communication, design and web experience development."));
  if (PROFILE.historical?.degree) {
    profileCard.appendChild(makeNode("p", "profile-detail", PROFILE.historical.degree));
  }
  const links = makeNode("div", "app-card-links");
  if (PROFILE.cvUrl) {
    const cv = makeNode("a", "text-link", language === "fr" ? "CONSULTER LE CV ↗" : "VIEW RESUME ↗");
    cv.href = PROFILE.cvUrl; cv.target = "_blank"; cv.rel = "noopener noreferrer"; links.appendChild(cv);
  }
  if (PROFILE.email) {
    const email = makeNode("a", "text-link", language === "fr" ? "ÉCRIRE UN MESSAGE ↗" : "SEND AN EMAIL ↗");
    email.href = "mailto:" + PROFILE.email; links.appendChild(email);
  }
  (PROFILE.socialLinks || []).forEach(item => {
    if (!item?.url || !item?.label) return;
    const link = makeNode("a", "text-link", item.label + " ↗");
    link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer"; links.appendChild(link);
  });
  if (links.childElementCount) profileCard.appendChild(links);
  profileContent.appendChild(profileCard);

  $("music-heading").textContent = language === "fr" ? "MUSIQUE / AUTRES PRESSAGES" : "MUSIC / OTHER PRESSINGS";
  const musicContent = $("music-content");
  musicContent.replaceChildren();
  (PROFILE.historical?.musicProjects || []).forEach((name, index) => {
    const card = makeNode("article", "directory-card music-card");
    card.appendChild(makeNode("span", "app-stamp", "PERSONAL MUSIC PROJECT  /  " + String(index + 1).padStart(2, "0")));
    card.appendChild(makeNode("h3", "app-card-title", name));
    card.appendChild(makeNode("p", "directory-card-summary", language === "fr"
      ? "Projet musical personnel — détails et sélections à découvrir."
      : "Personal music project — details and selections to discover."));
    musicContent.appendChild(card);
  });
}

function setLanguage(nextLanguage) {
  language = nextLanguage === "en" ? "en" : "fr";
  safeStorageSet("adam-projects-store.language", language);
  document.documentElement.lang = language;

  const copy = COPY[language];
  $("intro-eyebrow").textContent = copy.introEyebrow;
  $("intro-title").textContent = copy.introTitle;
  $("intro-subtitle").textContent = copy.introSub;
  $("intro-description").textContent = copy.introText;
  $("intro-status").replaceChildren(makeNode("span"), document.createTextNode(language === "fr" ? " FERMÉ" : " CLOSED"));
  $("intro-open").textContent = copy.enter;
  $("intro-direct").textContent = copy.direct;
  $("intro-2d").textContent = copy.limited;
  $("control-hint").textContent = copy.hint;
  $("header-eyebrow").textContent = copy.headerEyebrow;
  $("recenter-button").textContent = copy.recenter;
  $("browse-2d-button").textContent = copy.browse2d;
  $("exit-store-button").textContent = copy.exitStore;
  $("header-close").textContent = copy.close;
  $("gyro-button").textContent = cameraController?.isGyroscopeEnabled() ? copy.gyroOff : copy.gyroOn;
  $("directory-back").textContent = copy.backToStore;
  document.querySelectorAll("[data-lang]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.lang === language);
    button.setAttribute("aria-pressed", String(button.dataset.lang === language));
  });
  if ($("fallback-note")) {
    $("fallback-note").textContent = copy.webglError;
  }
  $("assistant-title").textContent = copy.assistantTitle;
  $("assistant-status").textContent = assistantEndpoint() ? copy.assistantStatusOnline : copy.assistantStatusOffline;
  $("sound-button").textContent = audioEnabled ? copy.soundOn : copy.soundOff;
  $("listening-button").textContent = copy.listeningButton;
  $("listening-title").textContent = copy.listeningTitle;
  $("listening-footnote").textContent = copy.listeningFootnote;
  $("assistant-input").placeholder = copy.assistantPlaceholder;
  $("assistant-send").textContent = copy.assistantSend;
  document.querySelectorAll("[data-assistant-prompt]").forEach((button, index) => {
    button.textContent = copy.assistantPrompts[index] || "";
    button.dataset.question = copy.assistantQuestions[index] || "";
  });
  renderRecordPanel(recordPanelState);
  if (directoryVisible) renderDirectory();
}

function enterStore(direct = false) {
  if (isOpen || isTransitioning) return;
  isOpen = true;
  directoryVisible = false;
  $("mode-2d").hidden = true;
  $("site-header").hidden = true;
  $("mobile-menu").hidden = false;
  if (store) {
    store.openDoors();
    store.greetShopkeeper?.();
    recordInteraction?.setActive(true);
    if (direct) cameraController?.reset();
    storeAudio?.playCue("arrival");
  }
  const status = $("intro-status");
  status.classList.add("is-open");
  status.replaceChildren(makeNode("span"), document.createTextNode(" " + COPY[language].opened));
  safeStorageSet("adam-projects-store.visited", "1");
  if (direct) {
    $("intro").classList.add("is-leaving");
    window.setTimeout(() => {
      $("intro").hidden = true;
      $("intro").classList.remove("is-leaving");
      $("control-hint").hidden = false;
      renderRecordPanel(recordPanelState);
    }, 220);
  } else {
    window.setTimeout(() => $("intro").classList.add("is-leaving"), 360);
    window.setTimeout(() => {
      $("intro").hidden = true;
      $("intro").classList.remove("is-leaving");
      $("control-hint").hidden = false;
      renderRecordPanel(recordPanelState);
    }, 1120);
  }
}

function exitStore() {
  if (!isOpen || directoryVisible || isTransitioning) return;
  isTransitioning = true;

  // Close all visitor-facing panels before the entrance doors begin to swing shut.
  if ($("assistant-dialog").open) $("assistant-dialog").close();
  if ($("project-dialog").open) $("project-dialog").close();
  if ($("listening-dialog").open) closeListeningRoom();
  recordInteraction?.setActive(false);
  renderRecordPanel({ mode: "none" });
  $("control-hint").hidden = true;
  $("site-header").hidden = true;
  $("mobile-menu").hidden = true;

  cameraController?.disableGyroscope();
  cameraController?.reset();
  store?.closeDoors?.();
  storeAudio?.playCue("departure");

  window.setTimeout(() => {
    isOpen = false;
    const status = $("intro-status");
    status.classList.remove("is-open");
    status.replaceChildren(makeNode("span"), document.createTextNode(" " + COPY[language].closed));
    $("intro").hidden = false;
    $("intro").classList.remove("is-leaving");
    $("intro").classList.add("is-arriving");
    showToast(COPY[language].leavingToast);
    isTransitioning = false;
    window.setTimeout(() => $("intro").classList.remove("is-arriving"), 900);
  }, 760);
}

function showDirectory() {
  directoryVisible = true;
  recordInteraction?.setActive(false);
  renderRecordPanel({ mode: "none" });
  $("intro").hidden = true;
  $("intro").classList.remove("is-leaving");
  $("site-header").hidden = true;
  $("mobile-menu").hidden = true;
  $("control-hint").hidden = true;
  $("mode-2d").hidden = false;
  renderDirectory();
}

function returnToStore() {
  directoryVisible = false;
  $("mode-2d").hidden = true;
  if (!isOpen) {
    enterStore(true);
    return;
  }
  $("mobile-menu").hidden = false;
  recordInteraction?.setActive(true);
  $("control-hint").hidden = false;
  renderRecordPanel(recordPanelState);
}

function toggleHeader(force) {
  if (!isOpen || directoryVisible) return;
  const header = $("site-header");
  const shouldOpen = force === undefined ? header.hidden : force;
  header.hidden = !shouldOpen;
  $("mobile-menu").hidden = shouldOpen;
  if (shouldOpen) $("gyro-button").textContent = cameraController?.isGyroscopeEnabled() ? COPY[language].gyroOff : COPY[language].gyroOn;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

async function toggleGyroscope() {
  if (!cameraController) return;
  if (cameraController.isGyroscopeEnabled()) {
    cameraController.disableGyroscope();
    $("gyro-button").textContent = COPY[language].gyroOn;
    showToast(language === "fr" ? "Gyroscope désactivé." : "Gyroscope disabled.");
    return;
  }
  const enabled = await cameraController.enableGyroscope();
  $("gyro-button").textContent = enabled ? COPY[language].gyroOff : COPY[language].gyroOn;
  showToast(enabled ? COPY[language].gyroOk : COPY[language].gyroError);
}

const assistantHistory = [];
let assistantBusy = false;
let audioEnabled = false;

function assistantEndpoint() {
  const raw = document.querySelector('meta[name="assistant-endpoint"]')?.content || "";
  return raw.trim();
}

function appendAssistantMessage(role, content, pending = false) {
  const message = makeNode("p", "assistant-message " + (role === "user" ? "is-user" : "is-assistant") + (pending ? " is-pending" : ""), content);
  $("assistant-messages").appendChild(message);
  $("assistant-messages").scrollTop = $("assistant-messages").scrollHeight;
  return message;
}

function localCatalogueReply(question) {
  const copy = COPY[language];
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/(application|applications|apps|outil|outils|tester|try)/.test(normalized)) {
    const list = APPLICATIONS.slice(0, 8).map(item => "• " + item.name + " — " + item.description[language]).join("\n");
    return copy.assistantOfflinePrefix + "\n\n" + list;
  }
  if (/(adam|parcours|about|profil|qui es|introdu|background|experience)/.test(normalized)) {
    const projects = PROFILE.historical?.degree ? PROFILE.historical.degree : "";
    const music = (PROFILE.historical?.musicProjects || []).join(", ");
    return copy.assistantOfflinePrefix + "\n\n" +
      (language === "fr"
        ? "Le portfolio présente Adam Soppelsa à travers des projets de communication, de création numérique, de développement web et de gestion de projet."
        : "The portfolio introduces Adam Soppelsa through communication, digital creation, web development and project-management work.") +
      (projects ? "\n\n" + (language === "fr" ? "Formation historique renseignée : " : "Previous qualification listed: ") + projects : "") +
      (music ? "\n\n" + (language === "fr" ? "Projets musicaux : " : "Music projects: ") + music : "");
  }
  if (/(musique|music|audio|artist|artiste)/.test(normalized)) {
    return copy.assistantOfflinePrefix + "\n\n" +
      (PROFILE.historical?.musicProjects || []).join(" · ") +
      (language === "fr" ? "\nDeux projets musicaux personnels sont référencés dans les données du portfolio." : "\nTwo personal music projects are listed in the portfolio data.");
  }
  const terms = normalized.split(/[^a-z0-9]+/).filter(term => term.length >= 4 && !["pour","avec","dans","cherche","projet","projets","looking","which","that","this","from","what"].includes(term));
  const matches = PROJECTS.map(project => {
    const searchable = [
      project.title.fr, project.title.en, project.short.fr, project.short.en,
      (project.skills || []).join(" "), (project.skillsEn || []).join(" ")
    ].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return { project, score: terms.reduce((score, term) => score + (searchable.includes(term) ? 1 : 0), 0) };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (matches.length) {
    return copy.assistantOfflinePrefix + "\n\n" + matches.map(({project}) =>
      "• " + project.title[language] + " — " + project.short[language]
    ).join("\n");
  }
  return language === "fr"
    ? copy.assistantOfflinePrefix + "\n\nJe peux présenter les projets, détailler les applications web ou t'orienter vers une catégorie. La conversation IA sera activée après le déploiement du serveur."
    : copy.assistantOfflinePrefix + "\n\nI can introduce the projects, explain the web apps or guide you to a category. Full AI conversation will be enabled once the server is deployed.";
}

async function sendAssistantMessage(rawMessage) {
  const message = String(rawMessage || "").trim().slice(0, 1200);
  if (!message || assistantBusy) return;
  assistantBusy = true;
  const input = $("assistant-input");
  const send = $("assistant-send");
  input.value = "";
  appendAssistantMessage("user", message);
  assistantHistory.push({ role: "user", content: message });
  send.disabled = true;
  const pending = appendAssistantMessage("assistant", COPY[language].assistantThinking, true);

  try {
    const endpoint = assistantEndpoint();
    if (!endpoint) {
      await new Promise(resolve => window.setTimeout(resolve, 180));
      const reply = localCatalogueReply(message);
      pending.remove();
      appendAssistantMessage("assistant", reply);
      assistantHistory.push({ role: "assistant", content: reply });
      if (assistantHistory.length > 8) assistantHistory.splice(0, assistantHistory.length - 8);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 28000);
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: assistantHistory.slice(-8) }),
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timeout);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.reply !== "string" || !payload.reply.trim()) {
      throw new Error("Assistant endpoint returned an invalid response.");
    }
    pending.remove();
    appendAssistantMessage("assistant", payload.reply.trim());
    assistantHistory.push({ role: "assistant", content: payload.reply.trim() });
    if (assistantHistory.length > 8) assistantHistory.splice(0, assistantHistory.length - 8);
  } catch (error) {
    pending.remove();
    appendAssistantMessage("assistant", COPY[language].assistantError);
    assistantHistory.push({ role: "assistant", content: COPY[language].assistantError });
    if (assistantHistory.length > 8) assistantHistory.splice(0, assistantHistory.length - 8);
  } finally {
    assistantBusy = false;
    send.disabled = false;
    input.focus();
  }
}

function openAssistant() {
  const dialog = $("assistant-dialog");
  store?.greetShopkeeper?.();
  storeAudio?.playCue("greeting");
  $("assistant-status").textContent = assistantEndpoint()
    ? COPY[language].assistantStatusOnline
    : COPY[language].assistantStatusOffline;
  if (!dialog.open) dialog.showModal();
  $("assistant-input").focus({ preventScroll: true });
}

function bindAssistantInterface() {
  $("assistant-close").addEventListener("click", () => $("assistant-dialog").close());
  $("shopkeeper-talk-button").addEventListener("click", openAssistant);
  $("assistant-form").addEventListener("submit", event => {
    event.preventDefault();
    sendAssistantMessage($("assistant-input").value);
  });
  document.querySelectorAll("[data-assistant-prompt]").forEach(button => {
    button.addEventListener("click", () => sendAssistantMessage(button.dataset.question));
  });
}

async function toggleStoreSound() {
  if (!storeAudio) storeAudio = createStoreAudio();
  const next = !audioEnabled;
  const enabled = await storeAudio.setEnabled(next);
  audioEnabled = enabled;
  $("sound-button").textContent = enabled ? COPY[language].soundOn : next ? COPY[language].soundUnavailable : COPY[language].soundOff;
  showToast(enabled
    ? (language === "fr" ? "Ambiance sonore activée." : "Ambient sound enabled.")
    : next
      ? COPY[language].soundUnavailable
      : (language === "fr" ? "Son désactivé." : "Sound disabled."));
}

function openListeningRoom() {
  const meta = document.querySelector('meta[name="youtube-video-id"]');
  const videoId = (meta?.content || "").trim();
  const host = $("youtube-player-host");
  host.replaceChildren();
  const status = $("listening-status");
  const copy = $("listening-copy");
  const validId = /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  host.hidden = !validId;
  if (!validId) {
    status.textContent = COPY[language].listeningMissing;
    copy.textContent = COPY[language].listeningMissingCopy;
  } else {
    const frame = document.createElement("iframe");
    frame.title = "SIDE A YouTube listening player";
    frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + "?rel=0&modestbranding=1&playsinline=1";
    frame.allow = "encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.loading = "lazy";
    host.appendChild(frame);
    status.textContent = COPY[language].listeningReady;
    copy.textContent = COPY[language].listeningReadyCopy;
  }
  $("listening-dialog").showModal();
}

function closeListeningRoom() {
  const host = $("youtube-player-host");
  host.replaceChildren();
  host.hidden = true;
  if ($("listening-dialog").open) $("listening-dialog").close();
}

function openGoldenPassDetails() {
  const dialog = $("project-dialog");
  const content = $("project-dialog-content");
  content.replaceChildren(
    makeNode("p", "dialog-eyebrow", "SIDE A / RARE FIND"),
    makeNode("h2", "dialog-title", COPY[language].collectibleTitle),
    makeNode("p", "dialog-summary", COPY[language].collectibleText)
  );
  dialog.showModal();
}

function discoverGoldenPass() {
  safeStorageSet("adam-projects-store.golden-pass-found", "1");
  recordInteraction?.markCollectibleFound();
  store?.markGoldenPassFound?.();
  storeAudio?.playCue("discovery");
  showToast(COPY[language].collectibleFoundToast);
  openGoldenPassDetails();
}

function revealEasterEgg() {
  showToast(COPY[language].easterToast);
  storeAudio?.playCue("easter");
}

function bindInterface() {
  document.querySelectorAll("[data-lang]").forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });
  $("intro-open").addEventListener("click", () => enterStore(false));
  $("intro-direct").addEventListener("click", () => enterStore(true));
  $("intro-2d").addEventListener("click", showDirectory);
  $("directory-back").addEventListener("click", returnToStore);
  $("directory-category").addEventListener("change", renderDirectory);
  $("recenter-button").addEventListener("click", () => cameraController?.reset());
  $("gyro-button").addEventListener("click", toggleGyroscope);
  $("browse-2d-button").addEventListener("click", showDirectory);
  $("header-close").addEventListener("click", () => toggleHeader(false));
  $("mobile-menu").addEventListener("click", () => toggleHeader(true));
  $("dialog-close").addEventListener("click", () => $("project-dialog").close());
  $("record-flip-button").addEventListener("click", () => recordInteraction?.flipSelected());
  $("record-open-button").addEventListener("click", () => recordInteraction?.toggleSleeve());
  $("record-details-button").addEventListener("click", () => recordInteraction?.showProjectDetails());
  $("record-return-button").addEventListener("click", () => recordInteraction?.returnSelectedRecord());
  $("application-return-button").addEventListener("click", () => recordInteraction?.returnSelectedApplication());
  $("easter-discover-button").addEventListener("click", revealEasterEgg);
  $("sound-button").addEventListener("click", toggleStoreSound);
  $("listening-button").addEventListener("click", openListeningRoom);
  $("exit-store-button").addEventListener("click", exitStore);
  $("collectible-discover-button").addEventListener("click", () => discoverGoldenPass(store?.goldenPass));
  $("listening-close").addEventListener("click", closeListeningRoom);
  $("listening-dialog").addEventListener("click", event => {
    if (event.target === $("listening-dialog")) closeListeningRoom();
  });
  $("listening-dialog").addEventListener("close", () => {
    $("youtube-player-host").replaceChildren();
    $("youtube-player-host").hidden = true;
  });
  bindAssistantInterface();
  $("project-dialog").addEventListener("click", event => {
    if (event.target === $("project-dialog")) $("project-dialog").close();
  });

  document.addEventListener("keydown", event => {
    if ($("assistant-dialog").open) return;
    const target = event.target;
    const isEditingTarget = target instanceof HTMLElement && (
      target.isContentEditable || !!target.closest("input, textarea, select, [contenteditable='true']")
    );
    if (event.key === "Escape" && $("project-dialog").open) {
      $("project-dialog").close();
      return;
    }
    if (event.key === "Escape" && recordInteraction?.hasSelection()) {
      event.preventDefault();
      if (recordInteraction.hasRecordSelection()) recordInteraction.returnSelectedRecord();
      else if (recordInteraction.hasApplicationSelection()) recordInteraction.returnSelectedApplication();
      return;
    }
    if (event.key === "Escape" && isOpen && !directoryVisible) {
      event.preventDefault();
      toggleHeader();
    }
    // Don't trigger store shortcuts while the visitor is typing or using browser modifiers.
    if (isEditingTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isOpen && !directoryVisible && event.key.toLowerCase() === "f") {
      recordInteraction?.flipSelected();
    }
    if (isOpen && !directoryVisible && event.key.toLowerCase() === "o") {
      recordInteraction?.toggleSleeve();
    }
    if ((event.key === "0" || event.key.toLowerCase() === "r") && isOpen && !directoryVisible) {
      if (recordInteraction?.hasRecordSelection()) recordInteraction.returnSelectedRecord();
      else if (recordInteraction?.hasApplicationSelection()) recordInteraction.returnSelectedApplication();
      else cameraController?.reset();
    }
  });
}

function showFallback(error) {
  console.warn("The 3D store could not be initialized. Opening the accessible collection.", error);
  webglAvailable = false;
  store?.renderer?.setAnimationLoop(null);
  recordInteraction?.destroy();
  recordInteraction = null;
  cameraController?.destroy();
  cameraController = null;
  $("world").hidden = true;
  $("loading").hidden = true;
  $("intro").hidden = true;
  $("mobile-menu").hidden = true;
  $("control-hint").hidden = true;
  $("mode-2d").hidden = false;
  $("fallback-note").hidden = false;
  $("directory-back").hidden = true;
  renderDirectory();
}

function boot() {
  storeAudio = createStoreAudio();
  bindInterface();
  const savedLanguage = safeStorageGet("adam-projects-store.language");
  setLanguage(savedLanguage || "fr");
  appendAssistantMessage("assistant", COPY[language].assistantWelcome);
  $("intro-direct").hidden = !safeStorageGet("adam-projects-store.visited");

  try {
    store = createStoreScene($("world"), PROJECTS, CATEGORIES, APPLICATIONS);
    if (safeStorageGet("adam-projects-store.golden-pass-found")) store.markGoldenPassFound();
    cameraController = createCameraController(store.camera, $("world"));
    recordInteraction = createRecordInteraction({
      scene: store.scene,
      camera: store.camera,
      canvas: $("world"),
      records: store.recordRoots,
      applications: store.applicationRoots,
      posters: store.posterRoots,
      shopkeeper: store.shopkeeper,
      easterEgg: store.easterEgg,
      collectible: safeStorageGet("adam-projects-store.golden-pass-found") ? null : store.goldenPass,
      onPanelChange: renderRecordPanel,
      onOpenProject: openProjectDetails,
      onOpenPoster: openPosterDetails,
      onOpenAssistant: openAssistant,
      onOpenEasterEgg: revealEasterEgg,
      onFoundCollectible: discoverGoldenPass,
      onSound: kind => storeAudio?.playCue(kind)
    });
    webglAvailable = true;
    clock = new THREE.Clock();
    let firstFrame = true;

    function renderSceneFrame() {
      const delta = Math.min(clock.getDelta(), .05);
      elapsed += delta;
      cameraController.update(delta);
      store.update(delta, elapsed);
      recordInteraction?.update(delta);
      store.renderer.render(store.scene, store.camera);
      if (firstFrame) {
        firstFrame = false;
        $("loading").hidden = true;
      }
    }

    function handleVisibilityChange() {
      if (!store?.renderer || !clock) return;
      if (document.hidden) {
        store.renderer.setAnimationLoop(null);
        return;
      }
      // Restart the clock so time spent in a background tab is not applied to animations.
      clock.start();
      store.renderer.setAnimationLoop(renderSceneFrame);
    }

    function handleStoreResize() {
      if (store) store.resize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
    }

    function handleWebGLContextLost(event) {
      event.preventDefault();
      store?.renderer?.setAnimationLoop(null);
      showFallback(new Error("WebGL context lost"));
    }

    store.renderer.setAnimationLoop(document.hidden ? null : renderSceneFrame);
    window.addEventListener("resize", handleStoreResize, { passive: true });
    $("world").addEventListener("webglcontextlost", handleWebGLContextLost);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  } catch (error) {
    showFallback(error);
  }
}

boot();
