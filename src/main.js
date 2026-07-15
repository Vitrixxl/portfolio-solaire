import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PLANETS, STOPS } from './content.js'
import { createUI } from './ui.js'

// ---------------------------------------------------------------- shaders

const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int k = 0; k < 5; k++) {
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`

const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vPositionView;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vPositionView = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const ATMOSPHERE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormalView;
  varying vec3 vPositionView;
  void main() {
    vec3 viewDirection = normalize(-vPositionView);
    float facing = abs(dot(normalize(vNormalView), viewDirection));
    float rim = pow(1.0 - clamp(facing, 0.0, 1.0), 3.2);
    gl_FragColor = vec4(uColor, rim * uIntensity);
  }
`

const SUN_VERT = /* glsl */ `
  varying vec3 vN;
  void main() {
    vN = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SUN_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vN;
  ${NOISE_GLSL}
  void main() {
    vec3 p = vN * 3.2;
    float n = fbm(p + uTime * 0.05);
    n += 0.5 * fbm(p * 2.5 - uTime * 0.08);
    vec3 core = vec3(1.0, 0.92, 0.62);
    vec3 mid = vec3(1.0, 0.62, 0.18);
    vec3 dark = vec3(0.72, 0.22, 0.05);
    vec3 c = mix(core, mid, smoothstep(0.35, 0.75, n));
    c = mix(c, dark, smoothstep(0.75, 1.05, n));
    gl_FragColor = vec4(c * 2.2, 1.0); // > 1.0 pour nourrir le bloom
  }
`

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aTint;
  uniform float uTime;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vTint = aTint;
    vAlpha = 0.5 + 0.5 * sin(uTime * 1.4 + aPhase);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (320.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const STAR_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vTint;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * (0.35 + vAlpha * 0.65);
    vec3 col = mix(vec3(0.75, 0.83, 1.0), vec3(1.0, 0.92, 0.78), vTint);
    gl_FragColor = vec4(col, a);
  }
`

// ---------------------------------------------------------------- scène

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x030409)

// Une source ponctuelle au centre donne à chaque planète un véritable
// terminateur jour/nuit. La décroissance est désactivée car les distances de
// cette scène sont volontairement compressées par rapport au système réel.
const sunlight = new THREE.PointLight(0xfff1d6, 3.2, 0, 0)
const spaceFill = new THREE.AmbientLight(0x52647e, 0.035)
scene.add(sunlight, spaceFill)

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000)
camera.position.set(0, 60, 150)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.55, 0.78)
composer.addPass(bloom)

// --- soleil
const SUN_RADIUS = 9
const sunUniforms = { uTime: { value: 0 } }
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_RADIUS, 96, 96),
  new THREE.ShaderMaterial({ uniforms: sunUniforms, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG })
)
scene.add(sun)

// halo du soleil (sprite additive)
function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(255, 190, 90, 0.7)')
  g.addColorStop(0.3, 'rgba(255, 140, 40, 0.28)')
  g.addColorStop(1, 'rgba(255, 100, 20, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
const glow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture(),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
}))
glow.scale.setScalar(SUN_RADIUS * 3.8)
scene.add(glow)

// --- planètes
const loadingManager = new THREE.LoadingManager()
const gltfLoader = new GLTFLoader(loadingManager)
const textureLoader = new THREE.TextureLoader()
const textureCache = new Map()
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
const modelBase = `${import.meta.env.BASE_URL}models/planets/`
const textureBase = `${import.meta.env.BASE_URL}textures/planets/`
const NASA_MODEL_RADIUS = 500

loadingManager.onError = (url) => {
  console.error(`Impossible de charger le modèle 3D : ${url}`)
}

function loadPlanetTexture(file) {
  if (textureCache.has(file)) return textureCache.get(file)
  const texture = textureLoader.load(`${textureBase}${file}`)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = maxAnisotropy
  texture.wrapS = THREE.RepeatWrapping
  textureCache.set(file, texture)
  return texture
}

function makeAtmosphere(model, atmosphere) {
  // Les géantes gazeuses sont aplaties aux pôles. On prend les dimensions du
  // maillage principal plutôt qu'une sphère basée sur le seul rayon : sinon le
  // halo dépasse fortement en haut et en bas, notamment autour de Jupiter.
  let surface = null
  let surfaceVertexCount = -1
  model.traverse((object) => {
    const vertexCount = object.geometry?.attributes.position?.count ?? -1
    if (object.isMesh && vertexCount > surfaceVertexCount) {
      surface = object
      surfaceVertexCount = vertexCount
    }
  })

  const bounds = new THREE.Box3().setFromObject(surface ?? model)
  const center = bounds.getCenter(new THREE.Vector3())
  const halfSize = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5 * atmosphere.scale)
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(atmosphere.color) },
        uIntensity: { value: atmosphere.intensity },
      },
      vertexShader: ATMOSPHERE_VERT,
      fragmentShader: ATMOSPHERE_FRAG,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    })
  )
  shell.position.copy(center)
  shell.scale.copy(halfSize)
  return shell
}

function preparePlanetModel(model, data) {
  // Les modèles NASA utilisent tous un rayon de référence de 500 unités.
  // On conserve donc leur géométrie propre (aplatissement et anneaux inclus)
  // et on applique uniquement l'échelle éditoriale du portfolio.
  model.scale.setScalar(data.radius / NASA_MODEL_RADIUS)
  model.updateMatrixWorld(true)

  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3())
  model.position.sub(center)
  model.updateMatrixWorld(true)
  model.name = `${data.name} — modèle NASA`

  model.traverse((object) => {
    if (!object.isMesh) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap']) {
        if (material[slot]) material[slot].anisotropy = maxAnisotropy
      }
      if (material.transparent) material.depthWrite = false
    }
  })
}

const planets = PLANETS.map((data) => {
  // Le groupe est l'ancre orbitale ; le modèle GLB est chargé dans un groupe
  // enfant distinct afin de faire tourner la planète autour de son axe incliné.
  const mesh = new THREE.Group()
  const spinner = new THREE.Group()
  mesh.name = `${data.name} — ancre orbitale`
  mesh.rotation.z = THREE.MathUtils.degToRad(data.axialTilt)
  mesh.add(spinner)
  scene.add(mesh)

  let clouds = null
  if (data.cloudTexture) {
    const cloudMap = loadPlanetTexture(data.cloudTexture)
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(data.radius * 1.008, 96, 64),
      new THREE.MeshStandardMaterial({
        map: cloudMap,
        alphaMap: cloudMap,
        transparent: true,
        opacity: 0.72,
        roughness: 1,
        depthWrite: false,
      })
    )
    spinner.add(clouds)
  }

  // ligne d'orbite
  const pts = []
  for (let a = 0; a <= 128; a++) {
    const t = (a / 128) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(t) * data.orbit, 0, Math.sin(t) * data.orbit))
  }
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 })
  )
  scene.add(orbitLine)

  let moon = null
  if (data.moon) {
    const moonMap = loadPlanetTexture('moon.jpg')
    moon = new THREE.Mesh(
      new THREE.SphereGeometry(data.radius * 0.27, 64, 48),
      new THREE.MeshStandardMaterial({
        map: moonMap,
        bumpMap: moonMap,
        bumpScale: 0.025,
        roughness: 1,
      })
    )
    scene.add(moon)
  }

  const planet = {
    data,
    mesh,
    spinner,
    model: null,
    atmosphere: null,
    clouds,
    moon,
    angle: data.angle,
    moonAngle: 0,
  }

  gltfLoader.load(`${modelBase}${data.model}`, (gltf) => {
    preparePlanetModel(gltf.scene, data)
    if (data.atmosphere) {
      planet.atmosphere = makeAtmosphere(gltf.scene, data.atmosphere)
      spinner.add(planet.atmosphere)
    }
    spinner.add(gltf.scene)
    planet.model = gltf.scene
  })

  return planet
})

// --- zones de clic invisibles (plus larges que les astres, pour viser facilement)
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
const clickables = []

const sunHit = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS * 1.35, 8, 8), HIT_MAT)
sunHit.renderOrder = -1
scene.add(sunHit)
clickables.push(sunHit)
sunHit.userData.stop = 0

planets.forEach((p, i) => {
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(p.data.radius * 2.0, 2.4), 8, 8),
    HIT_MAT
  )
  hit.renderOrder = -1
  hit.userData.stop = i + 1
  scene.add(hit)
  p.hit = hit
  clickables.push(hit)
})

const raycaster = new THREE.Raycaster()
const _pointer = new THREE.Vector2()

function pickStop(ndcX, ndcY) {
  _pointer.set(ndcX, ndcY)
  raycaster.setFromCamera(_pointer, camera)
  const hits = raycaster.intersectObjects(clickables, false)
  return hits.length ? hits[0].object.userData.stop : null
}

// --- curseur WebGL : scène orthographique dessinée par-dessus le rendu 3D.
// Au repos : petit anneau + point. Au survol d'un astre : se déploie en
// réticule de visée qui entoure la planète et tourne autour d'elle.
const uiScene = new THREE.Scene()
const uiCam = new THREE.OrthographicCamera(
  -window.innerWidth / 2, window.innerWidth / 2,
  window.innerHeight / 2, -window.innerHeight / 2, -10, 10
)

function circleLine(radius, segments, start = 0, arc = Math.PI * 2) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    const a = start + (i / segments) * arc
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

const ACCENT = 0xffc46b
const cursorLineMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })
const cursorDotMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })

const cursorGroup = new THREE.Group()
const cursorRing = new THREE.LineLoop(circleLine(1, 40), cursorLineMat)
cursorRing.scale.setScalar(10)
const cursorDot = new THREE.Mesh(new THREE.CircleGeometry(2.2, 16), cursorDotMat)
cursorGroup.add(cursorRing, cursorDot)
uiScene.add(cursorGroup)

const reticleMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })
const reticleGroup = new THREE.Group()
const reticleArcs = new THREE.Group()
for (let i = 0; i < 4; i++) {
  reticleArcs.add(new THREE.Line(
    circleLine(1, 24, (i * Math.PI) / 2 + 0.32, Math.PI / 2 - 0.64),
    reticleMat
  ))
}
const reticleTicks = new THREE.Group()
for (let i = 0; i < 4; i++) {
  const a = (i * Math.PI) / 2
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0),
    new THREE.Vector3(Math.cos(a) * 1.24, Math.sin(a) * 1.24, 0),
  ])
  reticleTicks.add(new THREE.Line(g, reticleMat))
}
reticleGroup.add(reticleArcs, reticleTicks)
uiScene.add(reticleGroup)

// réticule rectangulaire pour le menu des planètes : même langage que le
// réticule circulaire (coins + segments qui font le tour), en rectangle
const rectMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })
const rectGroup = new THREE.Group()
const RECT_CORNER = 0.4
for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(sx * (1 - RECT_CORNER), sy, 0),
    new THREE.Vector3(sx, sy, 0),
    new THREE.Vector3(sx, sy * (1 - RECT_CORNER), 0),
  ])
  rectGroup.add(new THREE.Line(g, rectMat))
}
// deux segments « coureurs » qui parcourent le périmètre du rectangle
const rectRunners = [0, 0.5].map(() => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
  const line = new THREE.Line(g, rectMat)
  rectGroup.add(line)
  return g
})
let rectRunnerU = 0

// position sur le périmètre d'un carré unitaire (u ∈ [0,1), sens horaire)
function rectPoint(u, out) {
  const t = (u % 1) * 4
  const edge = Math.floor(t)
  const f = t - edge
  if (edge === 0) out.set(-1 + 2 * f, 1, 0)        // haut
  else if (edge === 1) out.set(1, 1 - 2 * f, 0)    // droite
  else if (edge === 2) out.set(1 - 2 * f, -1, 0)   // bas
  else out.set(-1, -1 + 2 * f, 0)                  // gauche
}
const _rp = new THREE.Vector3()

uiScene.add(rectGroup)
const rectPos = new THREE.Vector2()
const rectSize = new THREE.Vector2(1, 1)
let rectOpacity = 0

const labelEl = document.getElementById('cursor-label')

const cursorPos = new THREE.Vector2()
const cursorTargetPos = new THREE.Vector2()
const reticlePos = new THREE.Vector2()
let cursorRingScale = 10
let reticleScale = 20
let reticleOpacity = 0
let hoveredStop = null
let lastHoverStop = null
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _right = new THREE.Vector3()

// --- étoiles
function makeStars(count) {
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const phase = new Float32Array(count)
  const tint = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const r = 420 + Math.random() * 380
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(2 * Math.random() - 1)
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
    pos[i * 3 + 1] = r * Math.cos(ph)
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
    size[i] = 0.6 + Math.random() * 1.8
    phase[i] = Math.random() * Math.PI * 2
    tint[i] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
  })
  return new THREE.Points(geo, mat)
}
const stars = makeStars(2600)
scene.add(stars)

// --- vaisseau du mode voyage (avant local = axe -Z)
function createSpacecraft() {
  const ship = new THREE.Group()
  const visual = new THREE.Group()
  ship.name = 'Vaisseau — mode voyage'
  ship.add(visual)

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7d0dc,
    metalness: 0.72,
    roughness: 0.3,
  })
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x141b28,
    metalness: 0.85,
    roughness: 0.24,
  })
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x59687c,
    metalness: 0.78,
    roughness: 0.32,
    side: THREE.DoubleSide,
  })
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x15364a,
    emissive: 0x0b789b,
    emissiveIntensity: 0.8,
    metalness: 0.35,
    roughness: 0.12,
  })

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 3.6, 16), hullMaterial)
  fuselage.rotation.x = -Math.PI / 2
  visual.add(fuselage)

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.63, 1.5, 16), hullMaterial)
  nose.rotation.x = -Math.PI / 2
  nose.position.z = -2.55
  visual.add(nose)

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 16), cockpitMaterial)
  cockpit.scale.set(0.72, 0.48, 1.2)
  cockpit.position.set(0, 0.5, -0.72)
  visual.add(cockpit)

  const wingShape = new THREE.Shape()
  wingShape.moveTo(-0.5, -0.75)
  wingShape.lineTo(-3.1, 1.25)
  wingShape.lineTo(-0.62, 0.92)
  wingShape.lineTo(0.62, 0.92)
  wingShape.lineTo(3.1, 1.25)
  wingShape.lineTo(0.5, -0.75)
  wingShape.closePath()
  const wings = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), wingMaterial)
  wings.rotation.x = Math.PI / 2
  wings.position.y = -0.15
  visual.add(wings)

  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 1.25, 12), darkMaterial)
    engine.rotation.x = Math.PI / 2
    engine.position.set(side * 0.48, -0.14, 1.65)
    visual.add(engine)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.055, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x81d9ff })
    )
    ring.position.set(side * 0.48, -0.14, 2.28)
    visual.add(ring)
  }

  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0x5bc8ff,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const flames = []
  for (const side of [-1, 1]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.23, 1.8, 12), flameMaterial)
    flame.rotation.x = Math.PI / 2
    flame.position.set(side * 0.48, -0.14, 3.12)
    visual.add(flame)
    flames.push(flame)
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 1.25), wingMaterial)
  tail.position.set(0, 0.62, 1.25)
  visual.add(tail)

  const engineLight = new THREE.PointLight(0x54c9ff, 5, 9, 2)
  engineLight.position.set(0, -0.1, 2.8)
  visual.add(engineLight)

  ship.userData.visual = visual
  ship.userData.flames = flames
  ship.visible = false
  return ship
}

const SHIP_SCALE = 0.9
const SHIP_FORWARD = new THREE.Vector3(0, 0, -1)
const SHIP_UP = new THREE.Vector3(0, 1, 0)
const spacecraft = createSpacecraft()
spacecraft.scale.setScalar(SHIP_SCALE)
scene.add(spacecraft)

const travel = {
  active: false,
  phase: 'idle',
  phaseStarted: 0,
  arrivalDuration: 2.8,
  exitDuration: 1.35,
  speed: 14,
  keys: new Set(),
  steering: new THREE.Vector2(),
  cameraStart: new THREE.Vector3(),
  cameraEnd: new THREE.Vector3(),
  lookStart: new THREE.Vector3(),
  lookEnd: new THREE.Vector3(),
  shipStart: new THREE.Vector3(),
  shipEnd: new THREE.Vector3(),
  flightDirection: new THREE.Vector3(),
  approachQuaternion: new THREE.Quaternion(),
  flightQuaternion: new THREE.Quaternion(),
  exitCameraStart: new THREE.Vector3(),
  exitLookStart: new THREE.Vector3(),
}

// grain statique généré une fois (voir style.css)
;(() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  document.querySelector('.grain').style.backgroundImage = `url(${c.toDataURL()})`
})()

// ---------------------------------------------------------------- navigation

const STOP_COUNT = PLANETS.length + 1 // 0 = vue d'ensemble
let current = 0
let animating = false
let transition = { from: 0, to: 0, t0: 0, duration: 2 }

// vitesse de simulation (sélecteur ×½ … ×4) et zoom (barre)
let timeScale = 1
let zoomTarget = 1
let zoomLevel = 1
// dérive continue de la caméra quand l'utilisateur ne fait rien
let autoYaw = 0

let navHoverEl = null
const ui = createUI({
  onNavigate: (i) => go(i),
  onNavHover: (el) => { navHoverEl = el },
  onTravelToggle: () => toggleTravel(),
})
ui.setActive(0)

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const _pos = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _side = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)
const _travelView = new THREE.Vector3()
const _travelRight = new THREE.Vector3()
const _travelCameraUp = new THREE.Vector3()
const _travelApproach = new THREE.Vector3()
const _travelShipUp = new THREE.Vector3()

// position/cible caméra pour une étape donnée (recalculées chaque frame,
// car les planètes bougent)
function anchorFor(stop, outPos, outLook) {
  if (stop === 0) {
    outPos.set(-42, 74, 168).multiplyScalar(zoomLevel)
    outLook.set(20, -4, 0)
    return
  }
  const p = planets[stop - 1]
  const r = p.data.radius
  p.mesh.getWorldPosition(_pos)
  _dir.copy(_pos).normalize()
  _side.crossVectors(UP, _dir).normalize()
  // caméra légèrement côté soleil : on arrive sur la face éclairée de la
  // planète, en surplomb, avec le reste du système qui s'étend derrière
  // plancher pour ne jamais passer sous la surface de la planète
  const z = Math.max(zoomLevel, 0.24)
  outPos.copy(_pos)
    .addScaledVector(_dir, -r * 2.0 * z)
    .addScaledVector(_side, r * 4.8 * z)
    .addScaledVector(UP, r * 2.3 * z)
  // décale le regard pour placer la planète à droite de l'écran (carte à
  // gauche) — décalage réduit sur écran étroit pour ne pas la couper
  const shift = 1.15 * Math.min(camera.aspect, 1.0)
  outLook.copy(_pos).addScaledVector(_side, -r * shift)
}

function startTravel() {
  if (travel.active) return

  travel.active = true
  travel.phase = 'arrival'
  travel.phaseStarted = clock.elapsedTime
  travel.keys.clear()
  travel.steering.set(0, 0)
  animating = false
  dragging = false
  navHoverEl = null
  canvas.classList.remove('dragging')

  camera.updateMatrixWorld(true)
  camera.getWorldDirection(_travelView).normalize()
  _travelRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  _travelCameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize()

  travel.cameraStart.copy(camera.position)
  travel.lookStart.copy(lookCurrent)
  travel.shipEnd.copy(camera.position).addScaledVector(_travelView, 10)
  travel.shipStart.copy(camera.position)
    .addScaledVector(_travelView, 44)
    .addScaledVector(_travelRight, 10)
    .addScaledVector(_travelCameraUp, 6)

  // À proximité d'une planète, le vaisseau repart tangentiellement à son
  // orbite pour ne pas foncer automatiquement dans l'astre observé.
  if (current > 0) {
    planets[current - 1].mesh.getWorldPosition(_pos)
    travel.flightDirection.crossVectors(UP, _pos).normalize()
    if (travel.flightDirection.lengthSq() < 0.5) travel.flightDirection.copy(_travelRight)
    if (travel.flightDirection.dot(_travelRight) < 0) travel.flightDirection.negate()
  } else {
    travel.flightDirection.copy(_travelRight)
  }
  travel.flightDirection.addScaledVector(UP, 0.06).normalize()

  _travelApproach.copy(travel.shipEnd).sub(travel.shipStart).normalize()
  travel.approachQuaternion.setFromUnitVectors(SHIP_FORWARD, _travelApproach)
  travel.flightQuaternion.setFromUnitVectors(SHIP_FORWARD, travel.flightDirection)
  _travelShipUp.copy(SHIP_UP).applyQuaternion(travel.flightQuaternion)

  travel.cameraEnd.copy(travel.shipEnd)
    .addScaledVector(travel.flightDirection, -9)
    .addScaledVector(_travelShipUp, 3.2)
  travel.lookEnd.copy(travel.shipEnd).addScaledVector(travel.flightDirection, 4)

  spacecraft.visible = true
  spacecraft.position.copy(travel.shipStart)
  spacecraft.quaternion.copy(travel.approachQuaternion)
  spacecraft.scale.setScalar(SHIP_SCALE * 0.55)
  spacecraft.userData.visual.rotation.set(0, 0, 0)

  ui.dismissHint()
  ui.hideCards()
  ui.setTravelMode(true)
  ui.setTravelPhase('APPROCHE DU VAISSEAU')
}

function stopTravel() {
  if (!travel.active || travel.phase === 'exit') return
  travel.phase = 'exit'
  travel.phaseStarted = clock.elapsedTime
  travel.keys.clear()
  travel.exitCameraStart.copy(camera.position)
  travel.exitLookStart.copy(lookCurrent)
  ui.setTravelPhase('RETOUR EN ORBITE')
}

function toggleTravel() {
  if (travel.active) stopTravel()
  else startTravel()
}

function go(i) {
  if (travel.active) return
  const target = THREE.MathUtils.clamp(i, 0, STOP_COUNT - 1)
  if (animating || target === current) return
  animating = true
  ui.dismissHint()
  ui.hideCards()
  transition = {
    from: current,
    to: target,
    t0: clock.getElapsedTime(),
    duration: THREE.MathUtils.clamp(1.2 + 0.35 * Math.abs(target - current), 1.7, 2.8),
  }
  current = target
  ui.setActive(target)
}

// molette = zoom / dézoom (la navigation se fait au clic sur les planètes)
window.addEventListener('wheel', (e) => {
  if (travel.active) return
  ui.dismissHint()
  zoomRange.value = THREE.MathUtils.clamp(Number(zoomRange.value) - e.deltaY * 0.05, 0, 100)
  applyZoomSlider()
}, { passive: true })

// clavier
const TRAVEL_CONTROL_KEYS = new Set(['z', 'w', 's', 'q', 'a', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const inputKey = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key)

window.addEventListener('keydown', (e) => {
  const key = inputKey(e)
  if (travel.active) {
    if (key === 'Escape') {
      e.preventDefault()
      stopTravel()
      return
    }
    if (TRAVEL_CONTROL_KEYS.has(key)) {
      e.preventDefault()
      if (travel.phase !== 'exit') travel.keys.add(key)
    }
    return
  }
  if (['ArrowDown', 'PageDown', ' '].includes(e.key)) go(current + 1)
  if (['ArrowUp', 'PageUp'].includes(e.key)) go(current - 1)
})

window.addEventListener('keyup', (e) => {
  travel.keys.delete(inputKey(e))
})

window.addEventListener('blur', () => travel.keys.clear())

// tactile
let touchY = null
window.addEventListener('touchstart', (e) => {
  if (!travel.active) touchY = e.touches[0].clientY
}, { passive: true })
window.addEventListener('touchend', (e) => {
  if (travel.active) return
  if (touchY === null) return
  const dy = touchY - e.changedTouches[0].clientY
  if (Math.abs(dy) > 45) go(current + Math.sign(dy))
  touchY = null
}, { passive: true })

// parallaxe souris + drag pour orbiter autour de l'astre courant
const mouse = { x: 0, y: 0 }
let dragging = false
let dragX = 0
let dragY = 0
let yawTarget = 0
let pitchTarget = 0
let yaw = 0
let pitch = 0

let downX = 0
let downY = 0

canvas.addEventListener('pointerdown', (e) => {
  if (travel.active) return
  downX = e.clientX
  downY = e.clientY
  if (e.pointerType === 'touch') return // sur tactile, le swipe sert à naviguer
  dragging = true
  dragX = e.clientX
  dragY = e.clientY
  canvas.classList.add('dragging')
})

const pointerPx = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
let cursorOnCanvas = false

window.addEventListener('pointermove', (e) => {
  pointerPx.x = e.clientX
  pointerPx.y = e.clientY
  cursorOnCanvas = e.pointerType === 'mouse' && e.target === canvas
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1
  if (dragging) {
    yawTarget -= (e.clientX - dragX) * 0.0032
    pitchTarget += (e.clientY - dragY) * 0.0026
    pitchTarget = THREE.MathUtils.clamp(pitchTarget, -1.1, 1.1)
    dragX = e.clientX
    dragY = e.clientY
  }
})

window.addEventListener('pointerleave', () => { cursorOnCanvas = false })
document.addEventListener('mouseleave', () => { cursorOnCanvas = false })

window.addEventListener('pointerup', (e) => {
  if (travel.active) return
  dragging = false
  canvas.classList.remove('dragging')
  // clic (et non drag) sur le canvas : voyage vers l'astre visé
  if (e.target === canvas && Math.hypot(e.clientX - downX, e.clientY - downY) < 10) {
    const ndcX = (e.clientX / window.innerWidth) * 2 - 1
    const ndcY = -((e.clientY / window.innerHeight) * 2 - 1)
    const stop = pickStop(ndcX, ndcY)
    if (stop !== null) go(stop)
  }
})

// barre de zoom : mapping exponentiel, 50 = distance nominale
const zoomRange = document.getElementById('zoom-range')
const applyZoomSlider = () => {
  // plage large : ×0.15 (très proche) à ×7 (très loin)
  zoomTarget = Math.pow(2.4, ((50 - Number(zoomRange.value)) / 50) * 2.2)
  ui.dismissHint()
}
zoomRange.addEventListener('input', applyZoomSlider)
document.getElementById('zoom-in').addEventListener('click', () => {
  zoomRange.value = Math.min(100, Number(zoomRange.value) + 12)
  applyZoomSlider()
})
document.getElementById('zoom-out').addEventListener('click', () => {
  zoomRange.value = Math.max(0, Number(zoomRange.value) - 12)
  applyZoomSlider()
})

// sélecteur de vitesse de simulation
const speedButtons = document.querySelectorAll('#hud-speed button[data-speed]')
speedButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    timeScale = Number(btn.dataset.speed)
    speedButtons.forEach((b) => b.classList.toggle('active', b === btn))
  })
})

// ---------------------------------------------------------------- boucle

const clock = new THREE.Clock()
const camTarget = new THREE.Vector3(-30, 52, 128)
const lookTarget = new THREE.Vector3(12, 0, 0)
const lookCurrent = new THREE.Vector3(12, 0, 0)
const _posA = new THREE.Vector3()
const _lookA = new THREE.Vector3()
const _posB = new THREE.Vector3()
const _lookB = new THREE.Vector3()
const _offset = new THREE.Vector3()
const _spherical = new THREE.Spherical()
const _travelForwardNow = new THREE.Vector3()
const _travelUpNow = new THREE.Vector3()
const _travelCameraTarget = new THREE.Vector3()
const _travelLookTarget = new THREE.Vector3()
const _travelLookNow = new THREE.Vector3()

let firstFrame = true

function hasTravelKey(...keys) {
  return keys.some((key) => travel.keys.has(key))
}

function updateSpacecraftFx(t, turn = 0, dt = 0) {
  const pulse = 0.82 + Math.sin(t * 24) * 0.13 + Math.sin(t * 9.3) * 0.05
  spacecraft.userData.flames.forEach((flame, i) => {
    flame.scale.y = pulse + i * 0.04
  })
  const visual = spacecraft.userData.visual
  visual.rotation.z += (turn * 0.38 - visual.rotation.z) * (1 - Math.exp(-7 * dt))
}

function updateTravelCamera(dt, t) {
  if (travel.phase === 'arrival') {
    const u = THREE.MathUtils.clamp((t - travel.phaseStarted) / travel.arrivalDuration, 0, 1)
    const e = easeInOut(u)
    spacecraft.position.lerpVectors(travel.shipStart, travel.shipEnd, e)
    spacecraft.position.addScaledVector(_travelCameraUp, Math.sin(u * Math.PI) * 2.2)
    spacecraft.quaternion.slerpQuaternions(
      travel.approachQuaternion,
      travel.flightQuaternion,
      THREE.MathUtils.smoothstep(u, 0.38, 1)
    )
    spacecraft.scale.setScalar(SHIP_SCALE * (0.55 + e * 0.45))

    const cameraEase = easeInOut(THREE.MathUtils.smoothstep(u, 0.18, 1))
    camera.position.lerpVectors(travel.cameraStart, travel.cameraEnd, cameraEase)
    _travelLookNow.lerpVectors(
      spacecraft.position,
      travel.lookEnd,
      THREE.MathUtils.smoothstep(u, 0.65, 1)
    )
    lookCurrent.lerpVectors(
      travel.lookStart,
      _travelLookNow,
      THREE.MathUtils.smoothstep(u, 0.05, 0.86)
    )
    updateSpacecraftFx(t, 0, dt)

    if (u >= 1) {
      travel.phase = 'flight'
      travel.phaseStarted = t
      ui.setTravelPhase('PILOTAGE LIBRE')
    }
  } else if (travel.phase === 'flight') {
    const turn = (hasTravelKey('q', 'a', 'ArrowLeft') ? 1 : 0)
      - (hasTravelKey('d', 'ArrowRight') ? 1 : 0)
    const vertical = (hasTravelKey('z', 'w', 'ArrowUp') ? 1 : 0)
      - (hasTravelKey('s', 'ArrowDown') ? 1 : 0)
    const steerEase = 1 - Math.exp(-7 * dt)
    travel.steering.x += (turn - travel.steering.x) * steerEase
    travel.steering.y += (vertical - travel.steering.y) * steerEase

    // Axe vertical volontairement inversé : Z/↑ pique vers le bas,
    // S/↓ cabre vers le haut. L'avant du vaisseau est son axe local -Z.
    spacecraft.rotateY(travel.steering.x * 0.92 * dt)
    spacecraft.rotateX(-travel.steering.y * 0.78 * dt)
    spacecraft.quaternion.normalize()

    _travelForwardNow.copy(SHIP_FORWARD).applyQuaternion(spacecraft.quaternion).normalize()
    _travelUpNow.copy(SHIP_UP).applyQuaternion(spacecraft.quaternion).normalize()
    spacecraft.position.addScaledVector(_travelForwardNow, travel.speed * dt)

    _travelCameraTarget.copy(spacecraft.position)
      .addScaledVector(_travelForwardNow, -8.8)
      .addScaledVector(_travelUpNow, 3.2)
    _travelLookTarget.copy(spacecraft.position).addScaledVector(_travelForwardNow, 5.5)
    const followEase = 1 - Math.exp(-5.5 * dt)
    camera.position.lerp(_travelCameraTarget, followEase)
    lookCurrent.lerp(_travelLookTarget, followEase)
    updateSpacecraftFx(t, travel.steering.x, dt)
  } else if (travel.phase === 'exit') {
    const u = THREE.MathUtils.clamp((t - travel.phaseStarted) / travel.exitDuration, 0, 1)
    const e = easeInOut(u)
    _travelForwardNow.copy(SHIP_FORWARD).applyQuaternion(spacecraft.quaternion).normalize()
    spacecraft.position.addScaledVector(_travelForwardNow, travel.speed * dt * (1 - e) * 0.45)
    anchorFor(current, _posB, _lookB)
    camera.position.lerpVectors(travel.exitCameraStart, _posB, e)
    lookCurrent.lerpVectors(travel.exitLookStart, _lookB, e)
    spacecraft.scale.setScalar(SHIP_SCALE * (1 - e * 0.65))
    updateSpacecraftFx(t, 0, dt)

    if (u >= 1) {
      travel.active = false
      travel.phase = 'idle'
      travel.steering.set(0, 0)
      spacecraft.visible = false
      spacecraft.scale.setScalar(SHIP_SCALE)
      spacecraft.userData.visual.rotation.set(0, 0, 0)
      ui.setTravelMode(false)
      ui.showCard(current)
    }
  }

  camera.lookAt(lookCurrent)
  camera.updateMatrixWorld(true)
}

function tick() {
  requestAnimationFrame(tick)
  // getDelta() met aussi à jour elapsedTime — ne pas appeler getElapsedTime()
  // en plus, sinon le delta est consommé et vaut toujours ~0
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  sunUniforms.uTime.value = t
  stars.material.uniforms.uTime.value = t
  sun.rotation.y += 0.02 * dt * timeScale

  // zoom amorti vers la valeur de la barre
  zoomLevel += (zoomTarget - zoomLevel) * (1 - Math.exp(-6 * dt))

  // orbites + rotations propres (intégrées pour supporter la vitesse variable)
  const sdt = dt * timeScale
  for (const p of planets) {
    p.angle += p.data.orbitSpeed * sdt
    p.mesh.position.set(Math.cos(p.angle) * p.data.orbit, 0, Math.sin(p.angle) * p.data.orbit)
    p.spinner.rotation.y += p.data.spinSpeed * 3 * sdt
    if (p.clouds) p.clouds.rotation.y += 0.035 * sdt
    p.hit.position.copy(p.mesh.position)
    if (p.moon) {
      p.moonAngle += 0.55 * sdt
      p.moon.rotation.y += 0.08 * sdt
      p.moon.position.copy(p.mesh.position)
      p.moon.position.x += Math.cos(p.moonAngle) * p.data.radius * 2.6
      p.moon.position.z += Math.sin(p.moonAngle) * p.data.radius * 2.6
      p.moon.position.y += Math.sin(p.moonAngle * 0.7) * p.data.radius * 0.4
    }
  }

  if (travel.active) {
    updateTravelCamera(dt, t)
  } else {
    // caméra désirée
    if (animating) {
    const u = Math.min((t - transition.t0) / transition.duration, 1)
    const e = easeInOut(u)
    anchorFor(transition.from, _posA, _lookA)
    anchorFor(transition.to, _posB, _lookB)
    camTarget.lerpVectors(_posA, _posB, e)
    // léger arc vertical pendant le transit
    camTarget.y += Math.sin(e * Math.PI) * _posA.distanceTo(_posB) * 0.09
    lookTarget.lerpVectors(_lookA, _lookB, e)
    if (u >= 1) {
      animating = false
      ui.showCard(current)
    }
    } else {
      anchorFor(current, camTarget, lookTarget)
    }

  // orbite au drag + dérive continue quand l'utilisateur ne fait rien :
  // rotation sphérique de la caméra autour du point visé
    if (animating) {
      // on ramène doucement l'orbite manuelle à zéro pendant le transit
      yawTarget *= Math.exp(-2.5 * dt)
      pitchTarget *= Math.exp(-2.5 * dt)
    } else if (!dragging) {
      autoYaw += 0.045 * dt
    }
    const kOrbit = 1 - Math.exp(-8 * dt)
    yaw += (yawTarget - yaw) * kOrbit
    pitch += (pitchTarget - pitch) * kOrbit
    const breathe = Math.sin(t * 0.22) * 0.04 // légère respiration verticale
    _offset.copy(camTarget).sub(lookTarget)
    _spherical.setFromVector3(_offset)
    _spherical.theta -= yaw + autoYaw
    _spherical.phi = THREE.MathUtils.clamp(_spherical.phi - pitch - breathe, 0.15, Math.PI - 0.15)
    _offset.setFromSpherical(_spherical)
    camTarget.copy(lookTarget).add(_offset)

  // parallaxe souris : offset borné ajouté à la cible (pas d'accumulation)
    const sway = current === 0 ? 3.5 : planets[Math.max(current - 1, 0)].data.radius * 0.4
    if (!dragging) {
      camTarget.x += mouse.x * sway
      camTarget.y += -mouse.y * sway * 0.8
    }

  // amortissement
    const k = 1 - Math.exp(-4.5 * dt)
    if (firstFrame) {
      camera.position.copy(camTarget)
      lookCurrent.copy(lookTarget)
      ui.showCard(0)
      firstFrame = false
    } else {
      camera.position.lerp(camTarget, k)
      lookCurrent.lerp(lookTarget, k)
    }
    camera.lookAt(lookCurrent)
    camera.updateMatrixWorld()
  }

  // ---- curseur WebGL + réticule de visée ----
  const cw = window.innerWidth
  const ch = window.innerHeight
  const picked = !travel.active && !dragging && cursorOnCanvas && !animating
    ? pickStop(mouse.x, -mouse.y)
    : null
  hoveredStop = picked !== null && picked !== current ? picked : null

  // petit curseur : suit la souris avec un léger retard
  cursorTargetPos.set(pointerPx.x - cw / 2, ch / 2 - pointerPx.y)
  cursorPos.lerp(cursorTargetPos, 1 - Math.exp(-30 * dt))
  cursorGroup.position.set(cursorPos.x, cursorPos.y, 0)
  cursorRing.rotation.z += dt * 1.4
  // l'anneau se resserre quand un astre est visé ou pendant un drag
  const ringScaleTarget = dragging ? 6 : hoveredStop !== null ? 5 : 10
  cursorRingScale += (ringScaleTarget - cursorRingScale) * (1 - Math.exp(-12 * dt))
  cursorRing.scale.setScalar(cursorRingScale)
  const cursorOpacityTarget = !travel.active && cursorOnCanvas ? 0.9 : 0
  cursorLineMat.opacity += (cursorOpacityTarget - cursorLineMat.opacity) * (1 - Math.exp(-14 * dt))
  cursorDotMat.opacity = cursorLineMat.opacity

  // réticule : entoure l'astre survolé et tourne autour de lui
  let retPosX = cursorPos.x
  let retPosY = cursorPos.y
  let retScaleTarget = 16
  let retOpacityTarget = 0
  if (hoveredStop !== null) {
    const isSun = hoveredStop === 0
    const obj = isSun ? sun : planets[hoveredStop - 1].mesh
    const r = isSun ? SUN_RADIUS : planets[hoveredStop - 1].data.radius
    obj.getWorldPosition(_pos)
    _v.copy(_pos).project(camera)
    if (_v.z < 1) {
      _right.setFromMatrixColumn(camera.matrixWorld, 0)
      _v2.copy(_pos).addScaledVector(_right, r).project(camera)
      const pxR = Math.hypot((_v2.x - _v.x) * cw / 2, (_v2.y - _v.y) * ch / 2)
      retPosX = _v.x * cw / 2
      retPosY = _v.y * ch / 2
      retScaleTarget = Math.max(pxR * 1.35, 30)
      retOpacityTarget = 0.85

      labelEl.textContent = `${STOPS[hoveredStop].name} — ${STOPS[hoveredStop].section}`.toUpperCase()
      const lx = retPosX + cw / 2 + retScaleTarget * 0.8 + 18
      const ly = ch / 2 - retPosY - retScaleTarget * 0.8 - 10
      labelEl.style.transform = `translate(${Math.min(lx, cw - 240)}px, ${Math.max(ly, 60)}px)`
    }
  }
  labelEl.classList.toggle('visible', hoveredStop !== null)
  const kRet = 1 - Math.exp(-14 * dt)
  if (hoveredStop !== null && hoveredStop === lastHoverStop) {
    // verrouillé sur l'astre : suivi exact, sinon l'amorti traîne derrière
    // la planète en mouvement et le réticule paraît décentré
    reticlePos.set(retPosX, retPosY)
    reticleScale = retScaleTarget
  } else {
    reticlePos.x += (retPosX - reticlePos.x) * kRet
    reticlePos.y += (retPosY - reticlePos.y) * kRet
    reticleScale += (retScaleTarget - reticleScale) * kRet
  }
  lastHoverStop = hoveredStop
  reticleOpacity += (retOpacityTarget - reticleOpacity) * kRet
  reticleGroup.position.set(reticlePos.x, reticlePos.y, 0)
  reticleGroup.scale.setScalar(reticleScale)
  reticleArcs.rotation.z += dt * 0.9
  reticleTicks.rotation.z -= dt * 0.45
  reticleMat.opacity = reticleOpacity
  reticleGroup.visible = reticleOpacity > 0.02

  // réticule rectangulaire sur l'élément de menu survolé
  const kRect = 1 - Math.exp(-18 * dt)
  if (navHoverEl) {
    const b = navHoverEl.getBoundingClientRect()
    rectPos.x += (b.left + b.width / 2 - cw / 2 - rectPos.x) * kRect
    rectPos.y += (ch / 2 - (b.top + b.height / 2) - rectPos.y) * kRect
    rectSize.x += (b.width / 2 + 16 - rectSize.x) * kRect
    rectSize.y += (b.height / 2 + 10 - rectSize.y) * kRect
    rectOpacity += (0.9 - rectOpacity) * kRect
  } else {
    rectOpacity += (0 - rectOpacity) * kRect
  }
  rectGroup.position.set(rectPos.x, rectPos.y, 0)
  rectGroup.scale.set(rectSize.x, rectSize.y, 1)
  rectMat.opacity = rectOpacity
  rectGroup.visible = rectOpacity > 0.02
  if (rectGroup.visible) {
    rectRunnerU = (rectRunnerU + dt * 0.35) % 1
    rectRunners.forEach((g, i) => {
      const pos = g.attributes.position
      rectPoint(rectRunnerU + i * 0.5, _rp)
      pos.setXYZ(0, _rp.x, _rp.y, 0)
      rectPoint(rectRunnerU + i * 0.5 + 0.045, _rp)
      pos.setXYZ(1, _rp.x, _rp.y, 0)
      pos.needsUpdate = true
    })
  }

  // HUD coordonnées
  if (travel.active) {
    const flightDistance = spacecraft.position.length()
    ui.setCoords(travel.phase === 'exit'
      ? 'RETOUR · PILOTE AUTO'
      : `VOL · ${flightDistance.toFixed(0)} MKM`)
  } else if (!animating) {
    if (current === 0) {
      ui.setCoords('SOL · 0.00 UA')
    } else {
      const d = planets[current - 1].mesh.position.length()
      ui.setCoords(`${PLANETS[current - 1].name.toUpperCase()} · ${(d / 37).toFixed(2)} UA`)
    }
  } else {
    ui.setCoords(`TRANSIT · ${camera.position.length().toFixed(0)} MKM`)
  }

  composer.render()
  // curseur/réticule dessinés par-dessus (hors bloom, toujours nets)
  renderer.autoClear = false
  renderer.clearDepth()
  renderer.render(uiScene, uiCam)
  renderer.autoClear = true
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  uiCam.left = -window.innerWidth / 2
  uiCam.right = window.innerWidth / 2
  uiCam.top = window.innerHeight / 2
  uiCam.bottom = -window.innerHeight / 2
  uiCam.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
})

tick()
