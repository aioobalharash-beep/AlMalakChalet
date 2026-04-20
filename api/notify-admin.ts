import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function ensureAdminInitialized() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT env var is not set. Add it in Vercel → Settings → Environment Variables with the JSON contents of the service account key.'
    );
  }
  const serviceAccount = JSON.parse(raw);
  initializeApp({ credential: cert(serviceAccount) });
}

type Body = {
  bookingId?: string;
  guest_name?: string;
  total_amount?: number | string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET = health check. Returns whether the env var is set, whether
  // firebase-admin initialized, and how many admin_tokens exist — so the
  // dashboard can surface the failure reason without needing server logs.
  if (req.method === 'GET') {
    const envVarSet = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    let adminSdkReady = false;
    let tokenCount: number | null = null;
    let projectId: string | null = null;
    let error: string | null = null;

    try {
      ensureAdminInitialized();
      adminSdkReady = true;
      const apps = getApps();
      projectId = apps[0]?.options?.projectId || null;
      const snap = await getFirestore().collection('admin_tokens').get();
      tokenCount = snap.size;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    res.status(200).json({
      envVarSet,
      adminSdkReady,
      projectId,
      tokenCount,
      error,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { bookingId, guest_name, total_amount } = (req.body || {}) as Body;

  if (!guest_name || total_amount === undefined) {
    res.status(400).json({ error: 'guest_name and total_amount are required' });
    return;
  }

  try {
    ensureAdminInitialized();
    const firestore = getFirestore();
    const messaging = getMessaging();

    const tokensSnap = await firestore.collection('admin_tokens').get();
    if (tokensSnap.empty) {
      res.status(200).json({ delivered: 0, pruned: 0, reason: 'no_tokens' });
      return;
    }

    const tokens = tokensSnap.docs.map((d) => d.id);
    const title = '🛎️ حجز جديد! (New Booking!)';
    const body = `${guest_name} has booked for ${total_amount} OMR.`;

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: {
        title,
        body,
        bookingId: bookingId || '',
        guest_name: String(guest_name),
        total_amount: String(total_amount),
        url: '/admin',
      },
      webpush: {
        fcmOptions: { link: '/admin' },
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        },
      },
    });

    const stale: string[] = [];
    response.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        stale.push(tokens[i]);
      }
    });

    if (stale.length) {
      const batch = firestore.batch();
      stale.forEach((t) => batch.delete(firestore.doc(`admin_tokens/${t}`)));
      await batch.commit();
    }

    res.status(200).json({
      delivered: response.successCount,
      failed: response.failureCount,
      pruned: stale.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('notify-admin failed:', message);
    res.status(500).json({ error: message });
  }
}
