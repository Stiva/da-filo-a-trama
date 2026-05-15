// public/sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification handler
// IMPORTANTE: con subscription `userVisibleOnly: true` la spec Web Push impone
// di mostrare SEMPRE una notifica. Su Chrome Android, omettere showNotification
// fa scattare il budget "silent push" che dopo poche violazioni invalida la
// subscription. Nessun early-return su `Notification.permission`.
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Nuova Notifica', body: event.data.text() };
    }
  }

  const title = data.title || 'Nuova notifica da Da Filo a Trama';
  const options = {
    body: data.body || 'Hai una nuova notifica',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url ? { url: data.url } : {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Click notification handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  const targetUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se c'è già una finestra aperta con questa URL, focalizzala
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
