// ============================================
// CHICHI - Combined Service Worker
// Handles: Caching + Push Notifications
// ============================================

console.log = function() {};
console.info = function() {};
console.debug = function() {};
console.warn = function() {};

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

    const notification = payload.notification || {};
    const data = payload.data || {};
    const notificationTitle = notification.title || data.title || 'CHICHI';
    const notificationOptions = {
        body: notification.body || data.body || 'You have a new update.',
        icon: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1785150967/53168_pz8kju.png',
        badge: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1785150967/53168_pz8kju.png',
        tag: data.tag || 'chichi-notification',
        requireInteraction: false,
        data: {
            url: data.url || data.click_action || '/'
        }
    };
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const targetUrl = new URL(urlToOpen, self.location.origin);
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (new URL(client.url).origin === targetUrl.origin && 'focus' in client) {
                    return client.focus().then(() => client.navigate(targetUrl.href));
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl.href);
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
