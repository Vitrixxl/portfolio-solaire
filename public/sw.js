// Ce projet n'utilise plus de service worker. Ce fichier remplace l'ancien
// worker éventuellement encore enregistré sur localhost, vide ses caches puis
// se désenregistre afin que Vite et les futurs déploiements servent toujours
// les fichiers actuels.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    await self.registration.unregister()
    const windows = await self.clients.matchAll({ type: 'window' })
    await Promise.all(windows.map((client) => client.navigate(client.url)))
  })())
})
