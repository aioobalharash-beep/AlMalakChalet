import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import app, { db } from './firebase';

const ADMIN_TOKENS_COLLECTION = 'admin_tokens';

// VAPID public key is safe to ship in the bundle — it's the public half of the
// Web Push certificate pair. The private half stays in Firebase.
const VAPID_KEY =
  (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) ||
  'BErsSKwySJ84fE7jBwq1BoZvkowA7qb-8TFaP1V1PQfOTlyWgbeDdvMZTJltugbZ2ij40Z4l7_PKRHsuGlaw5-O';

const FIREBASE_CONFIG_QS = new URLSearchParams({
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '',
}).toString();

let messagingInstance: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported())) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // Pass the Firebase web config as query params so the SW can initialize
  // without a hardcoded copy of the config (see firebase-messaging-sw.js).
  return navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${FIREBASE_CONFIG_QS}`,
    { scope: '/' }
  );
}

export type PushPermissionResult =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'default' }
  | { status: 'unsupported' }
  | { status: 'error'; error: string };

/**
 * Requests browser notification permission, fetches the FCM token, and
 * persists it under admin_tokens/{token} so the backend can fan out pushes.
 */
export async function enableAdminPushNotifications(
  adminId: string
): Promise<PushPermissionResult> {
  try {
    if (!('Notification' in window)) return { status: 'unsupported' };
    if (!VAPID_KEY) {
      return { status: 'error', error: 'Missing VITE_FIREBASE_VAPID_KEY' };
    }

    const messaging = await getMessagingInstance();
    if (!messaging) return { status: 'unsupported' };

    const permission = await Notification.requestPermission();
    if (permission === 'denied') return { status: 'denied' };
    if (permission !== 'granted') return { status: 'default' };

    const swReg = await registerFcmServiceWorker();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg || undefined,
    });

    if (!token) return { status: 'error', error: 'Empty FCM token' };

    await setDoc(doc(db, ADMIN_TOKENS_COLLECTION, token), {
      token,
      adminId,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });

    return { status: 'granted', token };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export async function disableAdminPushNotifications(token: string): Promise<void> {
  try {
    await deleteDoc(doc(db, ADMIN_TOKENS_COLLECTION, token));
  } catch {
    // non-fatal
  }
}

/**
 * Fire-and-forget trigger the booking flow can call right after a booking is
 * written. Posts to the server's /api/notifications/new-booking route, which
 * holds the FCM admin credentials. Never swallows booking confirmation — any
 * push failure is logged but does not throw.
 *
 * If you're using the Firestore-trigger Cloud Function instead, you don't need
 * to call this: writing to bookings/{id} already fires the function.
 */
export function notifyAdminsOfNewBooking(params: {
  bookingId: string;
  guest_name: string;
  total_amount: number | string;
}): void {
  try {
    fetch('/api/notifications/new-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      keepalive: true,
    }).catch((err) => console.warn('Push notification request failed:', err));
  } catch (err) {
    console.warn('Push notification dispatch skipped:', err);
  }
}

/**
 * Foreground message handler — call once on mount to show in-app toast / system
 * notification while the admin is actively viewing the dashboard. Background
 * delivery is handled entirely by firebase-messaging-sw.js.
 */
export async function onForegroundPush(
  handler: (title: string, body: string, data: Record<string, string>) => void
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  const unsubscribe = onMessage(messaging, (payload) => {
    const data = (payload.data || {}) as Record<string, string>;
    const title = payload.notification?.title || data.title || '🛎️ New Booking!';
    const body =
      payload.notification?.body ||
      data.body ||
      (data.guest_name && data.total_amount
        ? `${data.guest_name} just booked for ${data.total_amount} OMR. Click to view.`
        : 'A new booking just arrived.');
    handler(title, body, data);
  });

  return unsubscribe;
}
