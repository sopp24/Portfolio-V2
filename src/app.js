
import * as THREE from "three";
import { PROJECTS, CATEGORIES } from "./data/projects.js";
import { APPLICATIONS } from "./data/applications.js";
import { createStoreScene } from "./scene/store.js";
import { createCameraController } from "./controls/camera.js";
import { createRecordInteraction } from "./scene/record-interaction.js";

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
    hint: "Déplace la souris pour regarder · vise une pochette et clique · molette pour zoomer · Échap pour le menu",
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
    selectedPrompt: "VINYLE EXTRAIT · MANIPULEZ LA POCHETTE",
    returningPrompt: "REMISE EN RAYON EN COURS…",
    flip: "VOIR LE VERSO",
    showFront: "REVENIR AU RECTO",
    openSleeve: "OUVRIR LA POCHETTE",
    closeSleeve: "REFERMER LA POCHETTE",
    details: "FICHE DU PROJET",
    returnRecord: "REMETTRE DANS LE BAC"
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
    hint: "Move the mouse to look · aim at a sleeve and click · scroll to zoom · Esc for the menu",
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
    selectedPrompt: "RECORD EXTRACTED · HANDLE THE SLEEVE",
    returningPrompt: "RETURNING TO THE CRATE…",
    flip: "VIEW SIDE B",
    showFront: "RETURN TO SIDE A",
    openSleeve: "OPEN THE SLEEVE",
    closeSleeve: "CLOSE THE SLEEVE",
    details: "PROJECT DETAILS",
    returnRecord: "RETURN TO THE CRATE"
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

  const visible = isOpen && !directoryVisible;
  reticle.hidden = !visible || mode === "selected" || mode === "returning";
  reticle.classList.toggle("is-target", mode === "hover");

  if (!visible || mode === "none") {
    panel.hidden = true;
    hint.hidden = !visible;
    return;
  }

  panel.hidden = false;
  panel.classList.toggle("is-hovering", mode === "hover");
  panel.classList.toggle("is-returning", mode === "returning");
  const project = recordPanelState.project;
  $("record-title").textContent = project?.title?.[language] || "SIDE A";
  $("record-summary").textContent = mode === "hover"
    ? copy.hoverPrompt
    : mode === "returning"
      ? copy.returningPrompt
      : copy.selectedPrompt;
  $("record-actions").hidden = mode !== "selected";
  $("record-flip-button").textContent = recordPanelState.isFlipped ? copy.showFront : copy.flip;
  $("record-open-button").textContent = recordPanelState.isOpen ? copy.closeSleeve : copy.openSleeve;
  $("record-open-button").disabled = !!recordPanelState.isFlipped;
  $("record-details-button").hidden = !recordPanelState.isOpen;
  $("record-return-button").textContent = copy.returnRecord;
  hint.hidden = true;
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
  renderRecordPanel(recordPanelState);
  if (directoryVisible) renderDirectory();
}

function enterStore(direct = false) {
  if (isOpen) return;
  isOpen = true;
  directoryVisible = false;
  $("mode-2d").hidden = true;
  $("site-header").hidden = true;
  $("mobile-menu").hidden = false;
  if (store) {
    store.openDoors();
    recordInteraction?.setActive(true);
    if (direct) cameraController?.reset();
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
  $("record-return-button").addEventListener("click", () => recordInteraction?.returnSelected());
  $("project-dialog").addEventListener("click", event => {
    if (event.target === $("project-dialog")) $("project-dialog").close();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("project-dialog").open) {
      $("project-dialog").close();
      return;
    }
    if (event.key === "Escape" && recordInteraction?.hasSelection()) {
      event.preventDefault();
      recordInteraction.returnSelected();
      return;
    }
    if (event.key === "Escape" && isOpen && !directoryVisible) {
      event.preventDefault();
      toggleHeader();
    }
    if (isOpen && !directoryVisible && event.key.toLowerCase() === "f") {
      recordInteraction?.flipSelected();
    }
    if (isOpen && !directoryVisible && event.key.toLowerCase() === "o") {
      recordInteraction?.toggleSleeve();
    }
    if ((event.key === "0" || event.key.toLowerCase() === "r") && isOpen && !directoryVisible) {
      if (recordInteraction?.hasSelection()) recordInteraction.returnSelected();
      else cameraController?.reset();
    }
  });
}

function showFallback(error) {
  console.warn("The 3D store could not be initialized. Opening the accessible collection.", error);
  webglAvailable = false;
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
  bindInterface();
  const savedLanguage = safeStorageGet("adam-projects-store.language");
  setLanguage(savedLanguage || "fr");
  $("intro-direct").hidden = !safeStorageGet("adam-projects-store.visited");

  try {
    store = createStoreScene($("world"), PROJECTS);
    cameraController = createCameraController(store.camera, $("world"));
    recordInteraction = createRecordInteraction({
      scene: store.scene,
      camera: store.camera,
      canvas: $("world"),
      records: store.recordRoots,
      onPanelChange: renderRecordPanel,
      onOpenProject: openProjectDetails
    });
    webglAvailable = true;
    clock = new THREE.Clock();
    let firstFrame = true;

    store.renderer.setAnimationLoop(() => {
      if (document.hidden) return;
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
    });

    window.addEventListener("resize", () => store?.resize(window.innerWidth, window.innerHeight));
    $("world").addEventListener("webglcontextlost", event => {
      event.preventDefault();
      showFallback(new Error("WebGL context lost"));
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && store?.renderer) clock.start();
    });
  } catch (error) {
    showFallback(error);
  }
}

boot();
