import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import { Resend } from 'resend';
import {
  initDb,
  initCryptoOrders,
  getCryptoOrder,
  completeCryptoOrder,
  updateCryptoOrderStatus,
  createLicense,
} from '@/lib/db';

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

      // Send license key to customer via email
      if (order.email) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const planLabel = order.plan === '3month' ? '3 Months' : order.plan === '6month' ? '6 Months' : '1 Month';
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? 'FTWSentinel <noreply@yourdomain.com>',
            to: order.email,
            subject: 'Your FTWSentinel License Key',
            html: `
              <div style="background:#0d0d1f;color:#fff;font-family:monospace;padding:32px;border-radius:12px;max-width:480px;margin:0 auto">
                <h1 style="font-size:22px;margin-bottom:4px">FTW<span style="background:linear-gradient(to right,#818cf8,#c084fc,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Sentinel</span></h1>
                <p style="color:#a1a1aa;font-size:13px;margin-top:0">Your license is ready</p>
                <hr style="border:none;border-top:1px solid #27272a;margin:20px 0"/>
                <p style="color:#a1a1aa;font-size:12px;margin-bottom:8px">Plan: <span style="color:#fff">${planLabel}</span></p>
                <p style="color:#a1a1aa;font-size:12px;margin-bottom:16px">License Key:</p>
                <div style="background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:14px 18px;font-size:15px;letter-spacing:1px;color:#a5b4fc;word-break:break-all">
                  ${key}
                </div>
                <p style="color:#52525b;font-size:11px;margin-top:24px">Keep this key safe. Need help? Join our <a href="https://discord.gg/Prr7FuvBJc" style="color:#818cf8">Discord</a>.</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error('[crypto/webhook] Failed to send email:', emailErr);
        }
      }

    } else {
      await updateCryptoOrderStatus(String(payment_id), payment_status);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[crypto/webhook]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
