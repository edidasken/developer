// FlockChat — FCM Background Message Service Worker
// Must live at the hosting root (/firebase-messaging-sw.js)

// Always activate the newest SW version immediately (no waiting for tab close)
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDSkuryUDjYaZx7OoMvMRdU0NXpm1UC0y0',
  authDomain:        'flockos-comms.firebaseapp.com',
  projectId:         'flockos-comms',
  storageBucket:     'flockos-comms.firebasestorage.app',
  messagingSenderId: '679598098217',
  appId:             '1:679598098217:web:2d2636bb0a2f34b187d938',
});

const messaging = firebase.messaging();

// Background messages: app is closed or in a background tab
messaging.onBackgroundMessage((payload) => {
  const n     = payload.notification || {};
  const title = n.title || 'FlockChat';
  const body  = n.body  || '';
  const icon  = '/FlockChat/Images/FlockOS_Angels.png';

  self.registration.showNotification(title, {
    body,
    icon,
    badge: icon,
    tag:   payload.data?.channelId || 'flockchat',
    data:  payload.data || {},
  });
});

// Tap on notification → focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('flockos-comms') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
