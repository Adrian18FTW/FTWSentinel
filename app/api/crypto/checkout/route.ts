import { NextRequest, NextResponse } from 'next/server';
import { initDb, initCryptoOrders, createCryptoOrder } from '@/lib/db';

const PLAN_PRICES: Record<string, { usd: number; label: string }> = {
  '1month': { usd: 32, label: '1 Month' },
  '3month': { usd: 43, label: '3 Months' },
  '6month': { usd: 86, label: '6 Months' },
};

export async function POST(req: NextRequest) {
  try {
    const { plan, currency, email } = await req.json() as {
      plan: string;
      currency: 'btc' | 'eth';
      email?: string;
    };

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!['btc', 'eth'].includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    const { usd, label } = PLAN_PRICES[plan];
    const apiKey = process.env.NOWPAYMENTS_API_KEY!;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://your-domain.vercel.app';

    // Create NOWPayments invoice
    const res = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: usd,
        price_currency: 'usd',
        pay_currency: currency,
        order_id: `${plan}-${Date.now()}`,
        order_description: `FTWSentinel ${label} License`,
        ipn_callback_url: `${baseUrl}/api/crypto/webhook`,
        success_url: `${baseUrl}/payment/success`,
        cancel_url: `${baseUrl}/payment/cancel`,
        is_fixed_rate: true,
        is_fee_paid_by_user: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[crypto/checkout] NOWPayments error:', err);
      return NextResponse.json({ error: 'Payment provider error' }, { status: 502 });
    }

    const invoice = await res.json();

    await initDb();
    await initCryptoOrders();
    await createCryptoOrder(
      String(invoice.id),
      plan,
      email ?? '',
      usd,
      currency
    );

    return NextResponse.json({ url: invoice.invoice_url });
  } catch (e) {
    console.error('[crypto/checkout]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
