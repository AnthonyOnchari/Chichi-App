// Firebase Messaging Service Worker
// This file handles push notifications

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize Firebase (same config as main app)
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
    console.log('📬 Background message received:', payload);
    
    const notificationTitle = payload.notification.title || 'CHICHI';
    const notificationOptions = {
        body: payload.notification.body || 'New message',
        icon: '/icon.png',
        badge: '/badge.png',
        tag: 'chichi-notification',
        requireInteraction: false
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    console.log('🔔 Notification clicked');
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
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