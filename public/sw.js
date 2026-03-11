// public/sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

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
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png', // Optional, per Android
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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se c'è già una finestra aperta, mettile a fuoco ed eventualmente naviga
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
