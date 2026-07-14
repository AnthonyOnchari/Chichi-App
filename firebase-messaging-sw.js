// Firebase Cloud Messaging Service Worker
// Place this file in your root directory

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Firebase configuration - MUST match your main app
var firebaseConfig = {
    apiKey: "AIzaSyD_tSXJCOLffm4ZMtM8gXOCH5CXFOKdqWM",
    authDomain: "chichi-001.firebaseapp.com",
    projectId: "chichi-001",
    storageBucket: "chichi-001.firebasestorage.app",
    messagingSenderId: "219736252899",
    appId: "1:219736252899:web:626efc2fe5040efb7500d6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Your VAPID Public Key
const VAPID_KEY = 'BAFdptanJv5UUvAEM702UGDSlZ6UrkrZVA5paCzmJzhIyjaGZVumjyecwGzit-1vGmVwOVB45Y2Js29I8sAuflA';

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
    console.log('📨 [SW] Background message:', payload);
    
    const notificationTitle = payload.notification?.title || '💬 New Message';
    const notificationBody = payload.notification?.body || 'You have a new notification';
    const notificationIcon = 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png';
    
    const notificationOptions = {
        body: notificationBody,
        icon: notificationIcon,
        badge: notificationIcon,
        tag: 'chichi-notification-' + Date.now(),
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: payload.data || {}
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    console.log('🖱️ [SW] Notification clicked');
    event.notification.close();
    
    const url = '/';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
        .catch(function(err) {
            console.warn('⚠️ [SW] Failed to open app:', err);
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
    console.log('🚫 [SW] Notification closed');
});

// Service worker install
self.addEventListener('install', function(event) {
    console.log('📦 [SW] Installing...');
    self.skipWaiting();
    event.waitUntil(Promise.resolve());
});

// Service worker activate
self.addEventListener('activate', function(event) {
    console.log('✅ [SW] Activating...');
    event.waitUntil(
        clients.claim()
            .then(function() {
                console.log('✅ [SW] Clients claimed');
            })
            .catch(function(err) {
                console.warn('⚠️ [SW] Failed to claim clients:', err);
            })
    );
});

// Push event fallback
self.addEventListener('push', function(event) {
    console.log('📨 [SW] Push event:', event);
    
    var data = {};
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        try {
            var text = event.data.text();
            data = { notification: { title: 'CHICHI', body: text } };
        } catch (e2) {
            data = { notification: { title: 'CHICHI', body: 'New notification' } };
        }
    }
    
    if (data.notification && data.notification.body) {
        event.waitUntil(
            self.registration.showNotification(
                data.notification.title || 'CHICHI',
                {
                    body: data.notification.body,
                    icon: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
                    badge: 'https://res.cloudinary.com/u1uilb6f/image/upload/v1783926233/logo_ohie6r.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    data: data.data || {}
                }
            )
        );
    }
});

// Handle messages from client
self.addEventListener('message', function(event) {
    console.log('💬 [SW] Message from client:', event.data);
    if (event.data && event.data.type === 'ping') {
        event.ports[0].postMessage({ type: 'pong', timestamp: Date.now() });
    }
});

console.log('✅ [SW] Firebase Cloud Messaging Service Worker initialized');
