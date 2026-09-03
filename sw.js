// ============================================
// CHICHI - Combined Service Worker
// Handles: Caching + Push Notifications
// ============================================

// ---------- FIREBASE MESSAGING ----------
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "AIzaSyD_tSXJCOLffm4ZMtM8gXOCH5CXFOKdqWM",
    authDomain: "chichi-001.firebaseapp.com",
    databaseURL: "https://chichi-001-default-rtdb.firebaseio.com",
    projectId: "chichi-001",
    storageBucket: "chichi-001.firebasestorage.app",
    messagingSenderId: "219736252899",
    appId: "1:219736252899:web:626efc2fe5040efb7500d6"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(payload => {
  if (payload.data?.type === 'coin_received' || payload.notification?.title === 'Coins received') {
    return;
  }
    
    const notificationTitle = payload.notification.title || 'CHICHI';
    const notificationOptions = {
        body: payload.notification.body || 'New message',
        icon: '/icon-192.png',
        badge: '/badge.png',
        tag: 'chichi-notification',
        requireInteraction: false,
        data: {
            url: payload.data?.click_action || '/'
        }
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keyList) => {
        return Promise.all(
          keyList.map((key) => {
            return caches.delete(key);
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
      .catch((error) => {
        return self.clients.claim();
      })
  );
});
