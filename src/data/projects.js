export const CATEGORIES = [
  { id: "communication", fr: "Communication & stratégie", en: "Communication & strategy" },
  { id: "graphic-design", fr: "Création graphique & direction artistique", en: "Graphic design & art direction" },
  { id: "audiovisual-music", fr: "Audiovisuel & musique", en: "Audiovisual & music" },
  { id: "web-development", fr: "Développement web & applications", en: "Web development & applications" },
  { id: "data", fr: "Datajournalisme & datavisualisation", en: "Data journalism & data visualization" },
  { id: "project-management", fr: "Gestion de projet & événementiel", en: "Project management & events" }
];

export const PROJECTS = [
  {
    id: "rapmap",
    slug: "rapmap-el-nuevo-podcast",
    year: null,
    categories: ["communication", "audiovisual-music"],
    artwork: ["#bf633e", "#e2b36c", "#172d35"],
    title: { fr: "RAPMAP — El Nuevo Podcast", en: "RAPMAP — El Nuevo Podcast" },
    short: {
      fr: "Un podcast consacré au rap à l’échelle internationale, de la ligne éditoriale à l’épisode pilote.",
      en: "A podcast about rap around the world, from editorial concept to pilot episode."
    },
    context: {
      fr: "Explorer l’influence du rap dans différentes cultures et comprendre les dynamiques qui façonnent son évolution.",
      en: "Explore rap’s influence across cultures and understand the dynamics shaping its evolution."
    },
    challenge: {
      fr: "Construire un concept éditorial identifiable, une audience cible et un format capable de vivre dans la durée.",
      en: "Build a distinct editorial concept, a clear target audience and a format designed to last."
    },
    role: {
      fr: "Le descriptif historique présente un travail de conception collectif. La répartition individuelle des rôles reste à préciser.",
      en: "The historical description presents a collaborative project. Individual responsibilities still need confirmation."
    },
    work: {
      fr: ["Étude des acteurs et identification d’une marque partenaire potentielle", "Définition du public cible et de la ligne éditoriale", "Conception du podcast et structuration des épisodes", "Création d’un épisode pilote et d’un calendrier éditorial", "Développement de l’identité visuelle", "Réflexion sur le référencement des contenus"],
      en: ["Research into potential partners and identification of a brand sponsor", "Definition of the target audience and editorial direction", "Podcast concept and episode structure", "Pilot episode and editorial calendar", "Visual identity development", "Search visibility strategy for the content"]
    },
    skills: ["Stratégie éditoriale", "Podcast", "Communication musicale", "Identité visuelle", "SEO"],
    skillsEn: ["Editorial strategy", "Podcast production", "Music communication", "Visual identity", "SEO"],
    collaborators: [],
    outcome: {
      fr: "Un concept de podcast structuré, accompagné d’un pilote et d’un calendrier éditorial.",
      en: "A structured podcast concept supported by a pilot episode and an editorial calendar."
    },
    visualStatus: "provisional"
  },
  {
    id: "winehouse-promo",
    slug: "post-promotion-winehouse",
    year: null,
    categories: ["graphic-design", "communication", "audiovisual-music"],
    artwork: ["#d1a04f", "#643c35", "#e9d7b9"],
    title: { fr: "Post de promotion WINEHOUSE", en: "WINEHOUSE Promotional Post" },
    short: {
      fr: "Un visuel Instagram carré pour accompagner la sortie de l’album personnel « Winehouse ».",
      en: "A square Instagram visual supporting the release of the personal album “Winehouse”."
    },
    context: {
      fr: "Communiquer autour de la sortie d’un album en mettant en cohérence sa pochette, ses singles et ses plateformes d’écoute.",
      en: "Promote an album release by bringing its artwork, singles and listening platforms together."
    },
    challenge: {
      fr: "Faire tenir les informations essentielles dans un format social court, sans perdre l’identité du projet musical.",
      en: "Fit the essential release information into a concise social format without losing the album’s identity."
    },
    role: {
      fr: "Projet personnel : conception du post Instagram carré et mise en valeur des éléments de sortie.",
      en: "Personal project: designed the square Instagram post and highlighted the release information."
    },
    work: {
      fr: ["Création d’un post Instagram au format carré", "Mise en valeur de la pochette de l’album", "Présentation des deux singles sortis en amont", "Intégration des plateformes de streaming"],
      en: ["Creation of a square Instagram post", "Highlighting of the album artwork", "Presentation of the two previously released singles", "Integration of streaming platforms"]
    },
    skills: ["Création graphique", "Communication musicale", "Marketing digital", "Social media"],
    skillsEn: ["Graphic design", "Music communication", "Digital marketing", "Social media"],
    collaborators: [],
    outcome: {
      fr: "Un support promotionnel pensé pour annoncer la sortie et faciliter l’accès à l’album.",
      en: "A promotional asset designed to announce the release and make the album easy to access."
    },
    visualStatus: "provisional"
  },
  {
    id: "wero",
    slug: "wero-arrivee-en-france",
    year: null,
    categories: ["communication", "graphic-design", "project-management"],
    artwork: ["#274d61", "#e2c477", "#f0e6d2"],
    title: { fr: "WERO — Arrivée en France", en: "WERO — Launch in France" },
    short: {
      fr: "Une campagne multicanale autour du passage de Paylib à Wero, conçue avec Abel M’SOILI.",
      en: "A multichannel campaign around the transition from Paylib to Wero, created with Abel M’SOILI."
    },
    context: {
      fr: "Un projet scolaire consacré à la promotion de Wero lors de son arrivée sur le marché français.",
      en: "A university project focused on promoting Wero as it entered the French market."
    },
    challenge: {
      fr: "Expliquer un changement d’identité et accompagner les publics dans la découverte du nouveau service.",
      en: "Explain a brand transition and help audiences discover the new service."
    },
    role: {
      fr: "Travail en collaboration avec Abel M’SOILI. Les livrables mentionnés sont un livret de campagne et cinq messages destinés à différents canaux.",
      en: "Collaborative work with Abel M’SOILI. The documented deliverables are a campaign booklet and five messages for different channels."
    },
    work: {
      fr: ["Analyse du repositionnement de Paylib vers Wero", "Élaboration d’une stratégie de communication multicanale", "Réalisation d’un livret de campagne", "Conception de cinq messages adaptés à différents canaux"],
      en: ["Analysis of the repositioning from Paylib to Wero", "Development of a multichannel communication strategy", "Creation of a campaign booklet", "Design of five messages adapted to different channels"]
    },
    skills: ["Stratégie de communication", "Conception éditoriale", "Marketing", "Travail d’équipe", "Gestion de projet"],
    skillsEn: ["Communication strategy", "Editorial design", "Marketing", "Teamwork", "Project management"],
    collaborators: ["Abel M’SOILI"],
    outcome: {
      fr: "Un ensemble de supports de campagne cohérent, du livret aux messages multicanaux.",
      en: "A coherent set of campaign assets, from the booklet to the multichannel messages."
    },
    visualStatus: "provisional"
  },
  {
    id: "student-housing",
    slug: "logement-etudiant-bordelais",
    year: null,
    categories: ["data", "graphic-design"],
    artwork: ["#4d725e", "#d9c5a0", "#203b37"],
    title: { fr: "Logement étudiant bordelais", en: "Student Housing in Bordeaux" },
    short: {
      fr: "Une enquête de datajournalisme sur le lien entre localisation des logements et satisfaction étudiante.",
      en: "A data journalism project exploring the link between housing location and student satisfaction."
    },
    context: {
      fr: "Un travail consacré au sujet : « Logement étudiant bordelais : une satisfaction dépendante de la localisation ».",
      en: "A project investigating: “Student housing in Bordeaux: satisfaction depends on location”."
    },
    challenge: {
      fr: "Trouver des données ouvertes exploitables, les analyser puis rendre les résultats compréhensibles à travers un article et une infographie.",
      en: "Find usable open data, analyse it and make the findings understandable through an article and an infographic."
    },
    role: {
      fr: "Choix du sujet, recherche de données ouvertes, analyse, création de l’infographie et rédaction de l’article.",
      en: "Selected the topic, researched open data, analysed it, created the infographic and wrote the article."
    },
    work: {
      fr: ["Recherche de jeux de données ouverts", "Traitement et analyse des informations", "Création d’une infographie", "Rédaction d’un article de datajournalisme"],
      en: ["Research of open datasets", "Data processing and analysis", "Creation of an infographic", "Writing of a data journalism article"]
    },
    skills: ["Datajournalisme", "Open data", "Analyse statistique", "Datavisualisation", "Rédaction"],
    skillsEn: ["Data journalism", "Open data", "Statistical analysis", "Data visualization", "Writing"],
    collaborators: [],
    outcome: {
      fr: "Un article et une infographie qui mettent en perspective la satisfaction étudiante selon la localisation.",
      en: "An article and infographic examining student satisfaction in relation to location."
    },
    visualStatus: "provisional"
  },
  {
    id: "winehouse-amy",
    slug: "winehouse-amy-storytelling",
    year: null,
    categories: ["audiovisual-music", "communication", "graphic-design"],
    artwork: ["#a44731", "#dca35c", "#272b2c"],
    title: { fr: "WINEHOUSE AMY — Storytelling", en: "WINEHOUSE AMY — Storytelling" },
    short: {
      fr: "Une continuité narrative entre le trailer de « Winehouse » et le teaser de sa réédition « Winehouse Amy ».",
      en: "A narrative thread connecting the “Winehouse” trailer to the “Winehouse Amy” reissue teaser."
    },
    context: {
      fr: "Le premier trailer montre une montée d’escalier qui se termine par une confrontation mystérieuse. Le teaser de la réédition fait revenir cette présence.",
      en: "The first trailer follows an ascent up a staircase ending in a mysterious confrontation. The reissue teaser brings that presence back."
    },
    challenge: {
      fr: "Créer un lien narratif entre deux sorties musicales et transformer cette continuité en ressort de communication.",
      en: "Connect two music releases through a continuing narrative and use that continuity as a communication device."
    },
    role: {
      fr: "Projet personnel lié à l’univers musical « Winehouse » et à sa réédition.",
      en: "Personal project connected to the “Winehouse” music universe and its reissue."
    },
    work: {
      fr: ["Développement d’un récit en deux temps", "Conception d’une intrigue visuelle et d’un suspense", "Création du concept du teaser de réédition", "Recherche d’une cohérence artistique entre les deux projets"],
      en: ["Development of a two-part narrative", "Creation of visual intrigue and suspense", "Concept for the reissue teaser", "Artistic consistency between the two releases"]
    },
    skills: ["Storytelling", "Direction artistique", "Audiovisuel", "Marketing narratif", "Communication musicale"],
    skillsEn: ["Storytelling", "Art direction", "Audiovisual production", "Narrative marketing", "Music communication"],
    collaborators: [],
    outcome: {
      fr: "Un concept de campagne qui relie deux projets musicaux par une histoire commune.",
      en: "A campaign concept connecting two music projects through a shared story."
    },
    visualStatus: "provisional"
  },
  {
    id: "smac",
    slug: "smac-diffuser-aides-creation",
    year: null,
    categories: ["data", "project-management", "audiovisual-music"],
    artwork: ["#6c5a7c", "#d4ad7a", "#263b48"],
    title: { fr: "SMAC — Diffuser & aides à la création", en: "SMAC — Distribution & Creation Support" },
    short: {
      fr: "Un travail collectif de datavisualisation autour de quatre Scènes de Musiques Actuelles bordelaises.",
      en: "A collaborative data visualization project about four contemporary music venues in Bordeaux."
    },
    context: {
      fr: "Le projet de classe porte sur le Krakatoa, l’Inconnue, la Rock School Barbey et le Rocher de Palmer.",
      en: "The class project focuses on Le Krakatoa, L’Inconnue, Rock School Barbey and Le Rocher de Palmer."
    },
    challenge: {
      fr: "Documenter l’axe « Diffuser et aides à la création » et rendre visibles les enjeux de soutien à la création musicale.",
      en: "Document the “Distribution and creation support” topic and make the issues around support for music creation visible."
    },
    role: {
      fr: "Travail sur l’axe « Diffuser et aides à la création » avec Abel M’SOILI et Tom Martin, dans un projet collectif de classe.",
      en: "Worked on the “Distribution and creation support” topic with Abel M’SOILI and Tom Martin as part of a class-wide project."
    },
    work: {
      fr: ["Recherche et analyse de données culturelles", "Conception de datavisualisations", "Étude des dispositifs de diffusion et d’aide à la création", "Construction d’arguments fondés sur les données"],
      en: ["Research and analysis of cultural data", "Data visualization design", "Study of distribution and creation-support schemes", "Development of evidence-based arguments"]
    },
    skills: ["Analyse de données culturelles", "Datavisualisation", "Recherche", "Travail collaboratif", "Argumentation"],
    skillsEn: ["Cultural data analysis", "Data visualization", "Research", "Collaboration", "Evidence-based advocacy"],
    collaborators: ["Abel M’SOILI", "Tom Martin"],
    outcome: {
      fr: "Des visualisations consacrées aux dispositifs de diffusion et d’aide à la création des SMAC bordelaises.",
      en: "Visualizations focused on distribution and creation-support schemes across Bordeaux’s SMAC venues."
    },
    visualStatus: "provisional"
  },
  {
    id: "jugar-si-quieres",
    slug: "jugar-si-quieres",
    year: null,
    categories: ["communication", "audiovisual-music"],
    artwork: ["#d9a22f", "#9b4638", "#263e4e"],
    title: { fr: "#JugarSiQuieres", en: "#JugarSiQuieres" },
    short: {
      fr: "Une campagne de sensibilisation contre les discriminations visant les minorités dans le sport.",
      en: "An awareness campaign against discrimination targeting minorities in sport."
    },
    context: {
      fr: "Une campagne sur les réseaux sociaux pour défendre les minorités victimes de discriminations dans le sport.",
      en: "A social media campaign supporting minorities who experience discrimination in sport."
    },
    challenge: {
      fr: "Faire passer un message de sensibilisation à travers une proposition éditoriale et musicale sur une semaine.",
      en: "Deliver an awareness message through a week-long editorial and musical concept."
    },
    role: {
      fr: "Conception d’une émission sur une semaine et d’un album musical mobilisant les compétences musicales au service de la campagne.",
      en: "Created a week-long show concept and a music album, using musical skills in service of the campaign."
    },
    work: {
      fr: ["Conception d’une campagne sur les réseaux sociaux", "Élaboration d’un programme éditorial sur une semaine", "Création d’un album musical associé à la campagne"],
      en: ["Design of a social media campaign", "Development of a week-long editorial programme", "Creation of a music album connected to the campaign"]
    },
    skills: ["Communication inclusive", "Sensibilisation", "Storytelling", "Musique", "Créativité"],
    skillsEn: ["Inclusive communication", "Awareness campaign", "Storytelling", "Music", "Creative production"],
    collaborators: [],
    outcome: {
      fr: "Une campagne qui associe contenus sociaux, émission et création musicale autour d’un message commun.",
      en: "A campaign combining social content, a show and original music around one shared message."
    },
    visualStatus: "provisional"
  },
  {
    id: "swim-sync",
    slug: "swim-sync-piscine-interactive",
    year: 2025,
    categories: ["web-development", "data", "graphic-design"],
    artwork: ["#367e8a", "#c9d6b0", "#1e3944"],
    title: { fr: "SWIM SYNC — La piscine interactive", en: "SWIM SYNC — The Interactive Pool" },
    short: {
      fr: "Un objet connecté ludique qui rend tangibles des données de fréquentation des piscines publiques.",
      en: "A playful connected object that makes public-pool attendance data tangible."
    },
    context: {
      fr: "Projet conçu pendant le Hackathon POCL 2025 à Bordeaux, encadré par l’association Les Petits Débrouillards.",
      en: "Designed during the 2025 POCL Hackathon in Bordeaux, mentored by Les Petits Débrouillards."
    },
    challenge: {
      fr: "Transformer des données territoriales ouvertes en un objet physique compréhensible et interactif.",
      en: "Turn open territorial data into an understandable, interactive physical object."
    },
    role: {
      fr: "Participation à la conception du concept de piscine olympique miniature et de son fonctionnement connecté. La répartition technique individuelle reste à préciser.",
      en: "Contributed to the miniature Olympic-pool concept and its connected behaviour. Individual technical responsibilities still need confirmation."
    },
    work: {
      fr: ["Exploitation de données ouvertes sur les piscines publiques", "Conception d’un objet physique représentant une piscine olympique miniature", "Utilisation d’un nageur pour représenter la fréquentation", "Intégration de capteurs lumineux", "Actualisation automatique toutes les dix minutes", "Création du logo et de la présentation"],
      en: ["Use of open data about public swimming pools", "Design of a miniature Olympic-pool object", "Use of a swimmer to represent attendance", "Integration of light sensors", "Automatic refresh every ten minutes", "Creation of the logo and presentation"]
    },
    skills: ["Open data", "Objet connecté", "Datavisualisation", "Prototypage", "Design d’interaction"],
    skillsEn: ["Open data", "Connected object", "Data visualization", "Prototyping", "Interaction design"],
    collaborators: [],
    outcome: {
      fr: "Un concept de POCL qui matérialise les données de fréquentation par la position d’un nageur miniature.",
      en: "A connected-object concept that represents attendance data through the position of a miniature swimmer."
    },
    visualStatus: "provisional"
  },
  {
    id: "expodata",
    slug: "expodata-2025-inclusivite-numerique",
    year: 2025,
    categories: ["project-management", "data", "communication", "graphic-design"],
    artwork: ["#4c5b72", "#d6ae73", "#242c33"],
    title: { fr: "EXPODATA 2025 — Datavisualisation & inclusivité numérique", en: "EXPODATA 2025 — Data Visualization & Digital Inclusion" },
    short: {
      fr: "Une exposition de datavisualisations, avec un axe consacré au handicap et à l’organisation.",
      en: "A data visualization exhibition, including a focus on disability and organizations."
    },
    context: {
      fr: "Un projet d’exposition du BUT Information numérique dans les organisations, réunissant stratégie, création et organisation.",
      en: "An exhibition project within the Digital Information in Organizations degree, combining strategy, design and organization."
    },
    challenge: {
      fr: "Concevoir une exposition de datavisualisations et rendre accessibles des données sur la place des personnes en situation de handicap dans les organisations.",
      en: "Create a data visualization exhibition and make data about the place of people with disabilities in organizations accessible."
    },
    role: {
      fr: "Travail sur la datavisualisation « Handicap et Organisation », participation au pôle Partenariat et Trésorerie, développement de partenariats et copilotage du projet et de son budget avec Louise Munier.",
      en: "Worked on the “Disability and Organizations” visualization, contributed to Partnerships and Treasury, developed partnerships and co-led the project and its budget with Louise Munier."
    },
    work: {
      fr: ["Recherche et sélection de données ouvertes", "Création d’une datavisualisation sur la place des personnes handicapées dans les instances publiques et privées", "Participation au pôle Partenariat et Trésorerie", "Développement de partenariats, notamment avec Emmaüs Connect", "Copilotage du projet et du budget", "Contribution au vernissage"],
      en: ["Research and selection of open data", "Creation of a visualization about representation of people with disabilities in public and private bodies", "Contribution to Partnerships and Treasury", "Partnership development, including Emmaüs Connect", "Co-management of the project and budget", "Contribution to the exhibition opening"]
    },
    skills: ["Gestion de projet", "Partenariats", "Trésorerie", "Datavisualisation", "Événementiel", "Inclusivité numérique"],
    skillsEn: ["Project management", "Partnerships", "Budget management", "Data visualization", "Events", "Digital inclusion"],
    collaborators: ["Louise Munier"],
    outcome: {
      fr: "Le vernissage a accueilli près d’une centaine de visiteurs, selon le portfolio historique.",
      en: "The opening event welcomed close to one hundred visitors, according to the previous portfolio."
    },
    visualStatus: "provisional"
  },
  {
    id: "portfolio-v1",
    slug: "portfolio-v1",
    year: null,
    categories: ["web-development", "graphic-design"],
    artwork: ["#ad342e", "#d5ad88", "#242424"],
    title: { fr: "Portfolio V1", en: "Portfolio V1" },
    short: {
      fr: "Le premier portfolio web, conçu en HTML, CSS et JavaScript pour présenter le parcours et les réalisations.",
      en: "The first web portfolio, built with HTML, CSS and JavaScript to present the background and work."
    },
    context: {
      fr: "Un site personnel avec une direction artistique rouge et noire, une navigation par pages et une présentation des travaux.",
      en: "A personal website with a red-and-black art direction, page-based navigation and a project showcase."
    },
    challenge: {
      fr: "Concevoir et intégrer un premier espace professionnel bilingue pour réunir projets, parcours et contact.",
      en: "Design and build a first bilingual professional space bringing projects, background and contact together."
    },
    role: {
      fr: "Conception et développement front-end en HTML, CSS et JavaScript.",
      en: "Front-end design and development using HTML, CSS and JavaScript."
    },
    work: {
      fr: ["Définition d’une direction artistique rouge et noire", "Intégration d’une identité typographique", "Développement du menu et de la navigation", "Mise en place du basculement français / anglais", "Création des pages travaux, à propos et contact"],
      en: ["Definition of a red-and-black art direction", "Integration of a typographic identity", "Development of the menu and navigation", "Implementation of French / English switching", "Creation of work, about and contact pages"]
    },
    skills: ["HTML", "CSS", "JavaScript", "Intégration front-end", "Direction artistique", "Architecture de contenu"],
    skillsEn: ["HTML", "CSS", "JavaScript", "Front-end integration", "Art direction", "Content architecture"],
    collaborators: [],
    outcome: {
      fr: "Un premier portfolio personnel bilingue, utilisé comme base de contenu pour cette nouvelle expérience.",
      en: "A first bilingual personal portfolio, used as the content foundation for this new experience."
    },
    visualStatus: "provisional"
  }
];

export const PROFILE = {
  name: "Adam Soppelsa",
  currentDegree: null,
  institution: null,
  availability: null,
  cvUrl: null,
  email: null,
  socialLinks: [],
  historical: {
    degree: "BUT Information numérique dans les organisations",
    internships: [
      { year: 2023, company: "BMW et BMW Motorrad", location: "La Rochelle" },
      { year: 2024, company: "The Lifestyle Company", location: null }
    ],
    musicExperienceYears: 12,
    musicStreamsOrUses: "13 millions",
    musicProjects: ["Davis Miles", "STORY."]
  },
  note: "Les informations historiques et les champs actuels doivent être validés avant publication. Ne pas afficher les champs nulls."
};
