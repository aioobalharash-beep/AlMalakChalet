/* eslint-disable */
/* global self, clients */

// Pure Web Push service worker for FCM.
//
// Previously this file loaded firebase-messaging-compat.js and relied on
// Firebase's SDK inside the SW to render notifications. On iOS PWAs that path
// is unreliable — Safari handles SW initialization quirks badly, so Firebase's
// internal push handler sometimes never registers, which causes FCM pushes to
// arrive silently (nothing on the lock screen).
//
// FCM speaks the standard Web Push protocol (VAPID), so we can handle the push
// event directly with zero Firebase code. The client still uses firebase's
// getToken() to obtain the device token — but the SW is now a plain Web Push
// handler, which works identically on Chrome, Safari, and iOS PWAs.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { notification: { body: event.data.text() } };
    }
  }

  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || '🛎️ حجز جديد! (New Booking!)';
  const body =
    n.body ||
    d.body ||
    (d.guest_name && d.total_amount
      ? `${d.guest_name} has booked for ${d.total_amount} OMR.`
      : 'A new booking just arrived.');

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: d.bookingId || 'al-malak-booking',
      data: {
        url: d.url || '/admin',
        bookingId: d.bookingId || null,
      },
      vibrate: [200, 100, 200],
    })
  );
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
