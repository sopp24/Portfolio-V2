// Profile data — the single, validated source of truth for "who is Adam".
// Rules:
//  * `null` means "not provided yet": the UI hides it, the shopkeeper says it is not in the collection.
//  * `confirmed: false` marks historical facts carried over from the previous portfolio.
//    They may be displayed as history, never as a verified current claim.
//  * Never put secrets here. This file is public and is also bundled into the AI worker as trusted context.

export const PROFILE = {
  name: "Adam Soppelsa",

  // Facts confirmed by Adam in the project brief.
  status: {
    level: "Master 2",
    graduatingSoon: true,
    degreeTitle: null,        // TODO: exact Master 2 title
    institution: null,        // TODO: institution
    availableFrom: "September", // month only; the exact date is still to be provided
    availableFromDate: null,  // TODO: ISO date, e.g. "2027-09-01"
    openToInternational: true
  },

  headline: {
    fr: "Master 2 · profil polyvalent : communication, stratégie, création visuelle, gestion de projet, développement web, audiovisuel, musique et data.",
    en: "Master’s 2 · versatile profile: communication, strategy, visual creation, project management, web development, audiovisual, music and data."
  },
  availabilityLine: {
    fr: "Disponible à partir de septembre · ouvert à une mission à l’étranger.",
    en: "Available from September · open to working abroad."
  },

  // Skill families come from the validated project sheets. No tool or software is listed
  // until Adam confirms it.
  skillGroups: [
    { id: "communication", fr: "Communication & stratégie", en: "Communication & strategy",
      items: { fr: ["Stratégie multicanale", "Rédaction", "Marketing", "Storytelling", "Communication inclusive"], en: ["Multichannel strategy", "Writing", "Marketing", "Storytelling", "Inclusive communication"] } },
    { id: "creative", fr: "Création & direction artistique", en: "Creative & art direction",
      items: { fr: ["Création graphique", "Identité visuelle", "Conception éditoriale", "Direction artistique"], en: ["Graphic design", "Visual identity", "Editorial design", "Art direction"] } },
    { id: "media", fr: "Audiovisuel & musique", en: "Audiovisual & music",
      items: { fr: ["Podcast", "Narration audiovisuelle", "Composition", "Mix", "Promotion musicale"], en: ["Podcasting", "Audiovisual storytelling", "Songwriting", "Mixing", "Music promotion"] } },
    { id: "web", fr: "Développement web", en: "Web development",
      items: { fr: ["HTML / CSS / JavaScript", "Intégration front-end", "Applications web"], en: ["HTML / CSS / JavaScript", "Front-end integration", "Web applications"] } },
    { id: "data", fr: "Data & datavisualisation", en: "Data & data visualization",
      items: { fr: ["Données ouvertes", "Datajournalisme", "Datavisualisation", "Analyse"], en: ["Open data", "Data journalism", "Data visualization", "Analysis"] } },
    { id: "management", fr: "Gestion de projet & événementiel", en: "Project management & events",
      items: { fr: ["Gestion de projet", "Partenariats", "Budget", "Événementiel", "Travail d’équipe"], en: ["Project management", "Partnerships", "Budgeting", "Events", "Teamwork"] } }
  ],

  // Historical information from the previous portfolio. To be re-validated before it is presented as current.
  education: [
    { id: "but-ino", confirmed: false, level: "BUT",
      title: { fr: "BUT Information numérique dans les organisations", en: "BUT (university technology degree) in Digital Information in Organisations" },
      institution: null, years: null }
  ],
  experience: [
    { id: "bmw-2023", confirmed: false, kind: "internship", year: 2023,
      organisation: "BMW et BMW Motorrad", location: "La Rochelle", title: { fr: "Stage", en: "Internship" } },
    { id: "tlc-2024", confirmed: false, kind: "internship", year: 2024,
      organisation: "The Lifestyle Company", location: null, title: { fr: "Stage", en: "Internship" } }
  ],

  // Music is part of the identity, not a hobby footnote.
  music: {
    practices: {
      fr: ["Guitare", "Piano", "MAO", "Écriture", "Chant", "Mix", "Promotion de ses créations"],
      en: ["Guitar", "Piano", "Music production (DAW)", "Songwriting", "Vocals", "Mixing", "Promoting his own releases"]
    },
    // Figures from the previous portfolio — to be confirmed before they are republished.
    historical: { confirmed: false, yearsOfPractice: 12, streamsOrUses: { fr: "13 millions", en: "13 million" }, note: "À confirmer avant republication." },
    projects: [
      { id: "davis-miles", name: "Davis Miles", confirmed: false, artwork: null },
      { id: "story", name: "STORY.", confirmed: false, artwork: null },
      { id: "winehouse", name: "Winehouse", confirmed: true, artwork: null, note: { fr: "Album personnel, objet du post promotionnel.", en: "Personal album promoted in the Winehouse post." } }
    ]
  },

  // CV: drop the PDF in /assets/cv/ and set `url`. Until then the folder on the counter says it is being updated.
  cv: { url: null, fileName: "Adam-Soppelsa-CV.pdf", updated: null },

  // Contact. Nothing is rendered until `url` / `value` is filled. Do not invent links.
  contact: {
    email: null,                         // TODO: confirmed address
    // e-mail: deliberately absent. The owner supplied a candidate address from the previous portfolio to confirm
    // before publication; it is kept out of the deployed source until then (set `email` once confirmed).
    links: [
      { id: "linkedin",  label: "LinkedIn",  url: null },
      { id: "github",    label: "GitHub",    url: "https://github.com/sopp24", derived: "Owner of the verified SOPP Agents repositories" },
      { id: "instagram", label: "Instagram", url: null },
      { id: "spotify",   label: "Spotify",   url: null },
      { id: "youtube",   label: "YouTube",   url: null }
    ]
  },

  // Links used by the store.
  portfolioV1: "https://sopp24.github.io/Portfolio/index.html",
  applicationsHub: "https://sopp24.github.io/SOPP-agents/"
};

export const PROFILE_PENDING = [
  "status.degreeTitle", "status.institution", "status.availableFromDate", "cv.url",
  "contact.email", "contact.links[linkedin|instagram|spotify|youtube].url",
  "music.historical (confirm figures)", "experience[*] and education[*] (confirm before publication)"
];
