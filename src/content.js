// Contenu des étapes du voyage. index 0 = vue d'ensemble (héro), puis les 8 planètes.
// Les propriétés visuelles pointent vers les modèles GLB de la NASA et ajoutent
// les effets atmosphériques sans modifier l'échelle éditoriale du système.

export const GITHUB = 'https://github.com/Vitrixxl'
export const EMAIL = 'vitrice91@gmail.com'
export const PHONE = '+33783034523'

export const HERO = {
  kicker: 'VITRICE CASCALES — PORTFOLIO 2026',
  title: 'Vitrice Cascales',
  role: 'Développeur full-stack & data science — TypeScript · Python · Go',
  desc: 'Je conçois, développe et déploie des applications web complètes, de l’interface à la donnée. J’aime transformer des problématiques métier complexes en produits fiables, performants et simples à utiliser.',
  facts: 'Les Ulis · Recherche une alternance de 2 ans · Mastère Tech Lead',
}

export const PLANETS = [
  {
    name: 'Mercure',
    section: 'Profil',
    desc: 'Développeur full-stack & data science, je couvre toute la chaîne d’un produit : interfaces, API, données et mise en production. Mon objectif est de rendre simples et fiables des problématiques métier complexes.',
    facts: 'Objectif · Alternance de 2 ans dans le cadre d’un Mastère Tech Lead',
    orbit: 20, radius: 0.95, orbitSpeed: 0.5, spinSpeed: 0.08, angle: 0.6,
    model: 'mercury.glb', axialTilt: 0.034,
  },
  {
    name: 'Vénus',
    section: 'Compétences',
    desc: 'Une stack orientée produits web, traitement de données et déploiement, avec TypeScript, Go et Python comme langages principaux.',
    items: [
      { name: 'Langages', desc: 'TypeScript · Go · Python · Rust · SQL' },
      { name: 'Front-end', desc: 'React 19 · Zustand · TanStack Query · Tailwind' },
      { name: 'Back & data', desc: 'Bun · Elysia · FastAPI · PostgreSQL · DuckDB' },
      { name: 'Cloud & système', desc: 'Linux · GCP · Docker · Caddy · systemd · Git' },
      { name: 'Assistants IA', desc: 'Claude Code · Codex · OpenCode' },
    ],
    facts: 'TypeScript · Python · Go · React 19 · FastAPI · PostgreSQL',
    orbit: 28, radius: 1.45, orbitSpeed: 0.38, spinSpeed: -0.03, angle: 2.4,
    model: 'venus.glb', axialTilt: 177.4,
    atmosphere: { color: 0xffbd6d, intensity: 0.42, scale: 1.028 },
  },
  {
    name: 'Terre',
    section: 'Expérience — Immonator',
    desc: 'Alternance au sein d’une plateforme de données immobilières : développement web, data science, pipelines nationaux et mise en production.',
    items: [
      { name: 'Urbaninator.fr', desc: 'SPA React 19 et MapLibre GL pour analyser les données immobilières', url: 'https://urbaninator.fr' },
      { name: 'API & pipelines', desc: 'FastAPI asynchrone, PostgreSQL et traitements à l’échelle nationale' },
      { name: 'Matchinator', desc: 'Algorithme d’IA rapprochant automatiquement une annonce de son adresse' },
      { name: 'app.immonator.fr', desc: 'Interface de consultation des annonces transmises aux clients', url: 'https://app.immonator.fr' },
      { name: 'Production', desc: 'Docker · Caddy · systemd · migrations SQL versionnées' },
    ],
    facts: 'Immonator · Alternance · juil. 2025 — oct. 2026',
    orbit: 37, radius: 1.5, orbitSpeed: 0.3, spinSpeed: 0.22, angle: 4.1,
    model: 'earth.glb', cloudTexture: 'earth-clouds.jpg', axialTilt: 23.44,
    atmosphere: { color: 0x4ca6ff, intensity: 0.8, scale: 1.04 },
    moon: true,
  },
  {
    name: 'Mars',
    section: 'Expérience — Groupe Bovis',
    desc: 'Deux années d’alternance consacrées au développement et à la maintenance d’applications web full-stack en TypeScript.',
    items: [
      { name: 'Applications métier', desc: 'Développement et maintenance de solutions web full-stack' },
      { name: 'Front & back', desc: 'Conception d’interfaces et évolution de fonctionnalités métier' },
    ],
    facts: 'Groupe Bovis · Bondoufle · sept. 2023 — juil. 2025',
    orbit: 46, radius: 1.1, orbitSpeed: 0.24, spinSpeed: 0.2, angle: 0.9,
    model: 'mars.glb', axialTilt: 25.19,
    atmosphere: { color: 0xd9825b, intensity: 0.2, scale: 1.018 },
  },
  {
    name: 'Jupiter',
    section: 'Projets clés',
    desc: 'Des produits web et data allant de l’analyse immobilière à la mobilité urbaine, avec une attention portée à l’utilité métier et à la qualité technique.',
    items: [
      { name: 'Urbaninator.fr', desc: 'Carte d’analyse immobilière par quartier, ville et département', url: 'https://urbaninator.fr' },
      { name: 'Matchinator', desc: 'IA de qualification et de rapprochement d’annonces immobilières' },
      { name: 'app.immonator.fr', desc: 'Application client de consultation des annonces', url: 'https://app.immonator.fr' },
      { name: 'immonator.fr', desc: 'Site vitrine de l’offre et de l’expertise data', url: 'https://immonator.fr' },
      { name: 'UrbanFlow Mobility', desc: 'PWA de mobilité multimodale en temps réel avec API GTFS' },
    ],
    facts: 'Web · Data · IA · Full-stack · PWA',
    orbit: 64, radius: 4.6, orbitSpeed: 0.16, spinSpeed: 0.3, angle: 3.2,
    model: 'jupiter.glb', axialTilt: 3.13,
    atmosphere: { color: 0xe8c6a0, intensity: 0.24, scale: 1.012 },
  },
  {
    name: 'Saturne',
    section: 'Formation',
    desc: 'Un parcours centré sur le développement logiciel et la conception d’applications web, poursuivi vers un Mastère Tech Lead en alternance.',
    items: [
      { name: 'Bachelor Développement Web', desc: 'Digital Campus, Paris · 2025 — 2026' },
      { name: 'BTS SIO — option SLAM', desc: 'ISCO, Orsay · 2023 — 2025' },
    ],
    facts: 'Bachelor Développement Web · BTS SIO SLAM',
    orbit: 84, radius: 3.9, orbitSpeed: 0.12, spinSpeed: 0.28, angle: 5.3,
    model: 'saturn.glb', axialTilt: 26.73,
    atmosphere: { color: 0xe8d3aa, intensity: 0.2, scale: 1.012 },
  },
  {
    name: 'Uranus',
    section: 'Pratiques',
    desc: 'UrbanFlow Mobility a été conçu en intégrant les contraintes de sécurité, de confidentialité, d’accessibilité et d’éco-conception dès le projet.',
    items: [
      { name: 'Sécurité & données', desc: 'OWASP · RGPD' },
      { name: 'Accessibilité', desc: 'WCAG 2.1 niveau AA' },
      { name: 'Conception responsable', desc: 'Éco-conception et interfaces simples à utiliser' },
      { name: 'Déploiement', desc: 'Docker · Caddy · systemd · GCP · Linux' },
    ],
    facts: 'RGPD · OWASP · WCAG 2.1 AA · Éco-conception',
    orbit: 102, radius: 2.4, orbitSpeed: 0.09, spinSpeed: -0.18, angle: 1.7,
    model: 'uranus.glb', axialTilt: 97.77,
    atmosphere: { color: 0x8ddce6, intensity: 0.36, scale: 1.022 },
  },
  {
    name: 'Neptune',
    section: 'Contact',
    desc: 'Basé aux Ulis et à la recherche d’une alternance de deux ans dans le cadre d’un Mastère Tech Lead.',
    items: [
      { name: 'vitrice91@gmail.com', desc: 'Envoyer un e-mail', url: 'mailto:vitrice91@gmail.com' },
      { name: '07 83 03 45 23', desc: 'Téléphone', url: 'tel:+33783034523' },
      { name: 'github.com/Vitrixxl', desc: 'Voir le code', url: 'https://github.com/Vitrixxl' },
      { name: 'Les Ulis', desc: 'Localisation' },
    ],
    facts: 'Français natif · Anglais B2',
    orbit: 118, radius: 2.3, orbitSpeed: 0.07, spinSpeed: 0.2, angle: 4.8,
    model: 'neptune.glb', axialTilt: 28.32,
    atmosphere: { color: 0x3f75ff, intensity: 0.44, scale: 1.024 },
  },
]

export const STOPS = [{ name: 'Soleil', section: 'Accueil' }, ...PLANETS]
