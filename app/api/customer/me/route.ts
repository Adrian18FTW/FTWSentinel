import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCustomerById, getLicense, initCustomers } from '@/lib/db';

export async function GET() {
  try {
    const id = await getSession();
    if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await initCustomers();
    const customer = await getCustomerById(id);
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let license = null;
    if (customer.license_key) {
      license = await getLicense(customer.license_key);
    }

    return NextResponse.json({ customer, license });
  } catch (e) {
    console.error('[customer/me]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
