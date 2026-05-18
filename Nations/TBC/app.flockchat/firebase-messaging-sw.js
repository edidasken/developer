// FlockChat — FCM Background Message Service Worker
// Registered explicitly by _initFCM() in flockchat.js
// Handles notifications when the tab is closed or backgrounded.

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBA-fkxjABbwIHn0i6MPiXbGwahfJmuJeo',
  authDomain:        'flockos-notify.firebaseapp.com',
  projectId:         'flockos-notify',
  storageBucket:     'flockos-notify.firebasestorage.app',
  messagingSenderId: '321766738616',
  appId:             '1:321766738616:web:d2c1c53ad7493fcde4c24d',
});

const messaging = firebase.messaging();

// Background messages: tab is closed or in the background
messaging.onBackgroundMessage((payload) => {
  const n     = payload.notification || {};
  const title = n.title || 'FlockChat';
  const body  = n.body  || '';
  const icon  = '/FlockOS/New_Covenant/Images/FlockOS_Angels.png';

  self.registration.showNotification(title, {
    body,
    icon,
    badge: icon,
    tag:   payload.data?.channelId || 'flockchat',
    data:  payload.data || {},
  });
});

// Tap on notification → focus existing tab or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const convId = event.notification.data?.conversationId;
  const url    = convId
    ? `/FlockOS/New_Covenant/app.flockchat/app.flockchat.html#conv-${convId}`
    : '/FlockOS/New_Covenant/app.flockchat/app.flockchat.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes('app.flockchat') && 'focus' in w) {
          if (convId) w.postMessage({ type: 'OPEN_CONVERSATION', conversationId: convId });
          return w.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
