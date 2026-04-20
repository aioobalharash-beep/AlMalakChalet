import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import app, { db } from './firebase';

const ADMIN_TOKENS_COLLECTION = 'admin_tokens';
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let messagingInstance: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (!(await isSupported())) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
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
