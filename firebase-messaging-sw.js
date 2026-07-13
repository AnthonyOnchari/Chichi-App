// Firebase Cloud Messaging Service Worker
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

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Your VAPID Key (Public Key)
const VAPID_KEY = 'BAFdptanJv5UUvAEM702UGDSlZ6UrkrZVA5paCzmJzhIyjaGZVumjyecwGzit-1vGmVwOVB45Y2Js29I8sAuflA';

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
    console.log('Received background message:', payload);
    
    const notificationTitle = payload.notification.title || 'CHICHI';
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
        badge: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
        tag: payload.data.notificationType || 'notification',
        requireInteraction: true,
        data: payload.data || {}
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    // Focus or open the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
