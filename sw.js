// Service worker minimal : il permet d'installer l'application sur l'écran d'accueil.
// Volontairement, il ne met rien en cache : une connexion internet reste nécessaire
// (pas de mode hors-ligne des contenus, voir le cahier des charges).
//
// Il évite aussi un piège après une mise à jour : sans lui, le téléphone peut garder
// d'anciens fichiers quelques minutes et mélanger ancien et nouveau code. Ici, chaque
// fichier du site est revérifié auprès du serveur (réponse très courte s'il n'a pas changé).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evenement) => evenement.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  const memeSite = new URL(requete.url).origin === self.location.origin;
  if (requete.method !== 'GET' || !memeSite) return;   // polices Google, etc. : comportement normal
  // Une page ouverte (« navigation ») ne peut pas être recopiée avec d'autres réglages : on repart de son adresse
  const source = requete.mode === 'navigate' ? requete.url : requete;
  evenement.respondWith(fetch(source, { cache: 'no-cache' }));
});
