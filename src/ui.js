import { HERO, PLANETS, STOPS } from './content.js'

const pad = (n) => String(n).padStart(2, '0')

export function createUI({
  onNavigate,
  onNavHover = () => {},
  onTravelToggle = () => {},
  onOrbit = () => {},
}) {
  const cardsEl = document.getElementById('hud-cards')
  const navEl = document.getElementById('hud-nav')
  const statusEl = document.getElementById('hud-status')
  const hintEl = document.getElementById('hud-hint')
  const travelToggleEl = document.getElementById('travel-toggle')
  const travelToggleLabelEl = document.getElementById('travel-toggle-label')
  const travelHudEl = document.getElementById('travel-hud')
  const travelPhaseEl = document.getElementById('travel-phase')
  const travelExitEl = document.getElementById('travel-exit')
  const mobileFlightControlsEl = document.getElementById('mobile-flight-controls')
  const mobileOrbitEl = document.getElementById('mobile-orbit')
  const mobileOrbitLabelEl = document.getElementById('mobile-orbit-label')

  travelToggleEl.addEventListener('click', onTravelToggle)
  travelExitEl.addEventListener('click', onTravelToggle)
  mobileOrbitEl.addEventListener('click', onOrbit)

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
    btn.type = 'button'
    btn.setAttribute('aria-label', `Aller à ${s.name}, ${s.section}`)
    btn.innerHTML = `<span class="nav-label">${s.name}<em>${s.section}</em></span><span class="nav-tick"></span>`
    btn.addEventListener('click', () => onNavigate(i))
    btn.addEventListener('mouseenter', () => onNavHover(btn))
    btn.addEventListener('mouseleave', () => onNavHover(null))
    navEl.appendChild(btn)
    return btn
  })

  let hintDismissed = false
  let orbitTargetStop = null

  const updateOrbitTarget = (stop) => {
    const available = Number.isInteger(stop) && stop > 0 && Boolean(STOPS[stop])
    const nextStop = available ? stop : null
    if (nextStop === orbitTargetStop) return
    orbitTargetStop = nextStop
    mobileOrbitEl.disabled = !available
    mobileOrbitEl.classList.toggle('available', available)
    mobileOrbitLabelEl.textContent = available ? `ORBITE · ${STOPS[stop].name.toUpperCase()}` : 'VISEZ UNE PLANÈTE'
    mobileOrbitEl.setAttribute(
      'aria-label',
      available ? `Aller en orbite autour de ${STOPS[stop].name}` : 'Visez une planète pour aller en orbite'
    )
  }

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
      navItems.forEach((b, j) => {
        const active = i === j
        b.classList.toggle('active', active)
        if (active) b.setAttribute('aria-current', 'page')
        else b.removeAttribute('aria-current')
      })
      if (window.matchMedia('(max-width: 900px), (pointer: coarse)').matches) {
        const activeItem = navItems[i]
        const left = activeItem.offsetLeft - (navEl.clientWidth - activeItem.offsetWidth) / 2
        navEl.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
      }
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
      mobileFlightControlsEl.setAttribute('aria-hidden', String(!active))
      if (!active) updateOrbitTarget(null)
    },
    setTravelPhase(label) {
      travelPhaseEl.textContent = label
      statusEl.textContent = `MODE VOYAGE — ${label}`
    },
    setOrbitTarget(stop) {
      updateOrbitTarget(stop)
    },
  }
}
