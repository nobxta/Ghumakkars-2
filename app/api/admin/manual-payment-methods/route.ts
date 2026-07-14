import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

const MAX_QR_SIZE = 5 * 1024 * 1024;
const ALLOWED_QR_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const UPI_RE = /^[a-z0-9._-]{2,255}@[a-z][a-z0-9._-]{2,64}$/i;

async function uploadQr(file: File) {
  if (!ALLOWED_QR_TYPES.has(file.type)) throw new Error('QR image must be PNG, JPG, JPEG, or WebP.');
  if (file.size > MAX_QR_SIZE) throw new Error('QR image must be 5MB or smaller.');
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Image upload is not configured.');

  const bytes = Buffer.from(await file.arrayBuffer());
  const timestamp = Math.round(Date.now() / 1000).toString();
  const folder = 'manual_payment_qr';
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const body = new URLSearchParams();
  body.set('file', `data:${file.type};base64,${bytes.toString('base64')}`);
  body.set('api_key', apiKey);
  body.set('timestamp', timestamp);
  body.set('folder', folder);
  body.set('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Failed to upload QR image.');
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}

async function deleteQr(publicId?: string | null) {
  if (!publicId) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return;
  const timestamp = Math.round(Date.now() / 1000).toString();
  const signature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');
  const body = new URLSearchParams({ public_id: publicId, api_key: apiKey, timestamp, signature });
  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => {});
}

function cleanText(value: FormDataEntryValue | null, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function validateMethod(input: { nickname: string; upi_id: string; payee_name: string }) {
  if (!input.nickname) return 'Nickname is required.';
  if (!input.payee_name) return 'Payee name is required.';
  if (!input.upi_id) return 'UPI ID is required.';
  if (!UPI_RE.test(input.upi_id)) return 'Enter a valid UPI ID, for example name@bank.';
  return null;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('manual_payment_methods')
    .select('*')
    .order('is_default', { ascending: false })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ methods: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'reorder') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      await Promise.all(ids.map((id: string, index: number) => admin.from('manual_payment_methods').update({ display_order: index, updated_by: auth.user.id }).eq('id', id)));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  const form = await request.formData();
  const input = {
    nickname: cleanText(form.get('nickname'), 80),
    upi_id: cleanText(form.get('upi_id'), 320).toLowerCase(),
    payee_name: cleanText(form.get('payee_name'), 120),
  };
  const validationError = validateMethod(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const file = form.get('qr_image');
  let qr: { url: string; publicId: string } | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      qr = await uploadQr(file);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const wantsDefault = form.get('is_default') === 'true';
  const { data: maxOrder } = await admin
    .from('manual_payment_methods')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single();
  const { count: existingCount } = await admin
    .from('manual_payment_methods')
    .select('id', { count: 'exact', head: true });
  const shouldBeDefault = wantsDefault || !existingCount;
  if (shouldBeDefault) {
    await admin.from('manual_payment_methods').update({ is_default: false }).eq('is_default', true);
  }
  const { data, error } = await admin
    .from('manual_payment_methods')
    .insert([{
      ...input,
      instructions: cleanText(form.get('instructions'), 1000) || null,
      qr_image_url: qr?.url || null,
      qr_image_public_id: qr?.publicId || null,
      is_enabled: true,
      is_default: shouldBeDefault,
      display_order: Number(maxOrder?.display_order || 0) + 1,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    }])
    .select('*')
    .single();

  if (error) {
    await deleteQr(qr?.publicId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, method: data });
}
