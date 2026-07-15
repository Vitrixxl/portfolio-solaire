import { HERO, PLANETS, STOPS } from './content.js'

const pad = (n) => String(n).padStart(2, '0')

export function createUI({ onNavigate, onNavHover = () => {}, onTravelToggle = () => {} }) {
  const cardsEl = document.getElementById('hud-cards')
  const navEl = document.getElementById('hud-nav')
  const counterEl = document.getElementById('hud-counter')
  const coordsEl = document.getElementById('hud-coords')
  const statusEl = document.getElementById('hud-status')
  const hintEl = document.getElementById('hud-hint')
  const travelToggleEl = document.getElementById('travel-toggle')
  const travelToggleLabelEl = document.getElementById('travel-toggle-label')
  const travelHudEl = document.getElementById('travel-hud')
  const travelPhaseEl = document.getElementById('travel-phase')
  const travelExitEl = document.getElementById('travel-exit')

  travelToggleEl.addEventListener('click', onTravelToggle)
  travelExitEl.addEventListener('click', onTravelToggle)

  // ----- cartes -----
  const heroCard = document.createElement('div')
  heroCard.className = 'card card--hero'
  heroCard.innerHTML = `
    <div class="card-kicker">${HERO.kicker}</div>
    <h1 class="card-title">${HERO.title}</h1>
    <div class="card-role">${HERO.role}</div>
    <p class="card-desc">${HERO.desc}</p>
    <div class="card-facts">${HERO.facts}</div>
  `
  cardsEl.appendChild(heroCard)

  const cards = [heroCard]
  PLANETS.forEach((p, i) => {
    const el = document.createElement('div')
    el.className = 'card'
    const items = p.items
      ? `<ul class="card-items">${p.items
          .map(
            (it) => `<li>
              ${it.url
                ? `<a href="${it.url}" target="_blank" rel="noreferrer">${it.name}</a>`
                : `<strong>${it.name}</strong>`}
              <span>${it.desc}</span>
            </li>`
          )
          .join('')}</ul>`
      : ''
    el.innerHTML = `
      <div class="card-kicker">ESCALE ${pad(i + 1)} / ${pad(PLANETS.length)} — ${p.section.toUpperCase()}</div>
      <h2 class="card-title">${p.name}</h2>
      <div class="card-role">${p.section}</div>
      <p class="card-desc">${p.desc}</p>
      ${items}
      <div class="card-facts">${p.facts}</div>
    `
    cardsEl.appendChild(el)
    cards.push(el)
  })

  // ----- nav latérale -----
  const navItems = STOPS.map((s, i) => {
    const btn = document.createElement('button')
    btn.className = 'nav-item'
    btn.innerHTML = `<span class="nav-label">${s.name}<em>${s.section}</em></span><span class="nav-tick"></span>`
    btn.addEventListener('click', () => onNavigate(i))
    btn.addEventListener('mouseenter', () => onNavHover(btn))
    btn.addEventListener('mouseleave', () => onNavHover(null))
    navEl.appendChild(btn)
    return btn
  })

  let hintDismissed = false

  return {
    showCard(i) {
      cards.forEach((c, j) => c.classList.toggle('visible', i === j))
      statusEl.textContent = i === 0 ? 'EN ORBITE' : `EN ORBITE — ${STOPS[i].name.toUpperCase()}`
    },
    hideCards() {
      cards.forEach((c) => c.classList.remove('visible'))
      statusEl.textContent = 'TRANSIT…'
    },
    setActive(i) {
      navItems.forEach((b, j) => b.classList.toggle('active', i === j))
      counterEl.innerHTML = `${pad(i)}&nbsp;/&nbsp;${pad(STOPS.length - 1)}`
    },
    setCoords(text) {
      coordsEl.textContent = text
    },
    dismissHint() {
      if (hintDismissed) return
      hintDismissed = true
      hintEl.classList.add('hidden')
    },
    setTravelMode(active) {
      document.body.classList.toggle('travel-mode', active)
      travelToggleEl.classList.toggle('active', active)
      travelToggleEl.setAttribute('aria-pressed', String(active))
      travelToggleLabelEl.textContent = active ? 'QUITTER LE VOYAGE' : 'MODE VOYAGE'
      travelHudEl.setAttribute('aria-hidden', String(!active))
    },
    setTravelPhase(label) {
      travelPhaseEl.textContent = label
      statusEl.textContent = `MODE VOYAGE — ${label}`
    },
  }
}
