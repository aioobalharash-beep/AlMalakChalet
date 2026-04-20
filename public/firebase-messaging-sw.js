/* eslint-disable */
/* global importScripts, firebase, self, clients */

// Background Firebase Cloud Messaging service worker.
// Registered by src/services/pushNotifications.ts at the app's root scope.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// The client registers this SW with the public Firebase web config embedded as
// query params (see pushNotifications.ts → registerFcmServiceWorker). That way
// the same VITE_FIREBASE_* values the SPA uses also flow into the worker
// without any copy-paste step.
const swParams = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: swParams.get('apiKey') || '',
  authDomain: swParams.get('authDomain') || '',
  projectId: swParams.get('projectId') || '',
  storageBucket: swParams.get('storageBucket') || '',
  messagingSenderId: swParams.get('messagingSenderId') || '',
  appId: swParams.get('appId') || '',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title =
    (payload.notification && payload.notification.title) ||
    data.title ||
    '🛎️ حجز جديد! (New Booking!)';
  const body =
    (payload.notification && payload.notification.body) ||
    data.body ||
    (data.guest_name && data.total_amount
      ? `${data.guest_name} has booked for ${data.total_amount} OMR.`
      : 'A new booking just arrived.');

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.bookingId || 'al-malak-booking',
    data: {
      url: data.url || '/admin',
      bookingId: data.bookingId || null,
    },
    vibrate: [200, 100, 200],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/admin';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return null;
    })
  );
});
