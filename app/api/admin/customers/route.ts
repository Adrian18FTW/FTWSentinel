import { NextRequest, NextResponse } from 'next/server';
import { initCustomers, getAllCustomers, setCustomerSuspended, deleteCustomer, revokeLicense, getLicense } from '@/lib/db';

function requireAdmin(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initCustomers();
  const customers = await getAllCustomers();
  return NextResponse.json(customers);
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await initCustomers();

  const { id, action } = await req.json() as { id: number; action: 'suspend' | 'unsuspend' | 'delete' };
  if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });

  if (action === 'suspend') {
    // Suspend account and revoke their license if they have one
    const customers = await getAllCustomers();
    const customer = customers.find((c: { id: number }) => c.id === id) as { id: number; license_key: string | null } | undefined;
    if (customer?.license_key) {
      const license = await getLicense(customer.license_key);
      if (license) await revokeLicense(license.id);
    }
    await setCustomerSuspended(id, true);
  } else if (action === 'unsuspend') {
    await setCustomerSuspended(id, false);
  } else if (action === 'delete') {
    await deleteCustomer(id);
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
