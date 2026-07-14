// Firebase Messaging Service Worker
// This file handles background message processing and push notifications

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

var firebaseConfig = {
  apiKey: "AIzaSyD_tSXJCOLffm4ZMtM8gXOCH5CXFOKdqWM",
  authDomain: "chichi-001.firebaseapp.com",
  projectId: "chichi-001",
  storageBucket: "chichi-001.firebasestorage.app",
  messagingSenderId: "219736252899",
  appId: "1:219736252899:web:626efc2fe5040efb7500d6"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  
  // Handle background messages
  messaging.onBackgroundMessage(function(payload) {
    console.log('Background message received:', payload);
    
    const title = payload.notification ? payload.notification.title : 'CHICHI';
    const body = payload.notification ? payload.notification.body : 'New notification';
    const icon = 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png';
    
    const options = {
      body: body,
      icon: icon,
      badge: icon,
      requireInteraction: false,
      vibrate: [200, 100, 200]
    };
    
    return self.registration.showNotification(title, options);
  });
  
  // Handle notification click
  self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(function(windowClients) {
          // Check if there is already a window/tab open with the target URL
          for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            if (client.url === '/' || client.url === '/chichi.buzz' || client.url.includes('chichi')) {
              if ('focus' in client) {
                return client.focus();
              }
            }
          }
          // If not, open a new window/tab with the target URL
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  });
  
  // Handle notification close
  self.addEventListener('notificationclose', function(event) {
    console.log('Notification closed');
  });
  
  console.log('✅ Firebase Messaging Service Worker loaded');
} catch (error) {
  console.error('❌ Service Worker error:', error);
}

// Generic install handler
self.addEventListener('install', function(event) {
  console.log('[ServiceWorker] Installing...');
  self.skipWaiting();
});

// Generic activate handler  
self.addEventListener('activate', function(event) {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(clients.claim());
});

// Fallback message handler
self.addEventListener('message', function(event) {
  console.log('[ServiceWorker] Message received:', event.data);
});
