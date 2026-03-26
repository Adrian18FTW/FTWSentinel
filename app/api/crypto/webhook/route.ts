import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import {
  initDb,
  initCryptoOrders,
  getCryptoOrder,
  completeCryptoOrder,
  updateCryptoOrderStatus,
  createLicense,
} from '@/lib/db';
import { randomBytes } from 'crypto';

function verifySignature(body: string, sig: string, secret: string): boolean {
  const expected = createHmac('sha512', secret).update(body).digest('hex');
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function generateKey(): string {
  const hex = randomBytes(8).toString('hex').toUpperCase();
  return `FTWAC-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get('x-nowpayments-sig') ?? '';
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET ?? '';

    if (ipnSecret && !verifySignature(rawBody, sig, ipnSecret)) {
      console.warn('[crypto/webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { payment_id, payment_status } = payload;

    if (!payment_id) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    await initDb();
    await initCryptoOrders();

    const order = await getCryptoOrder(String(payment_id));
    if (!order) {
      // Unknown order — still return 200 so NOWPayments doesn't retry forever
      return NextResponse.json({ ok: true });
    }

    if (payment_status === 'finished' || payment_status === 'confirmed') {
      if (order.status === 'finished') {
        // Already processed — idempotent
        return NextResponse.json({ ok: true });
      }

      const key = generateKey();
      const note = order.email ? `crypto:${order.currency} | ${order.email}` : `crypto:${order.currency}`;
      await createLicense(key, order.plan, note);
      await completeCryptoOrder(String(payment_id), key);

      // Optionally send the key via Discord webhook or email here
      console.log(`[crypto/webhook] License issued: ${key} for order ${payment_id}`);
    } else {
      await updateCryptoOrderStatus(String(payment_id), payment_status);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[crypto/webhook]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
