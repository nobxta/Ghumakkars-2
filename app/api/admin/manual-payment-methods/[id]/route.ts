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
  const timestamp = Math.round(Date.now() / 1000).toString();
  const folder = 'manual_payment_qr';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');
  const body = new URLSearchParams();
  body.set('file', `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`);
  body.set('api_key', apiKey);
  body.set('timestamp', timestamp);
  body.set('folder', folder);
  body.set('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
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
  const signature = crypto.createHash('sha1').update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest('hex');
  const body = new URLSearchParams({ public_id: publicId, api_key: apiKey, timestamp, signature });
  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }).catch(() => {});
}

function cleanText(value: FormDataEntryValue | null, max = 500) {
  return String(value || '').trim().slice(0, max);
}

async function normalizeDefault(admin: ReturnType<typeof createAdminClient>, id?: string) {
  if (id) {
    await admin.from('manual_payment_methods').update({ is_default: false }).neq('id', id);
    return;
  }
  const { data: firstEnabled } = await admin.from('manual_payment_methods').select('id').order('display_order', { ascending: true }).order('created_at', { ascending: true }).limit(1).single();
  if (firstEnabled?.id) await admin.from('manual_payment_methods').update({ is_default: true }).eq('id', firstEnabled.id);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin.from('manual_payment_methods').select('*').eq('id', params.id).single();
  if (existingError || !existing) return NextResponse.json({ error: 'Payment method not found.' }, { status: 404 });

  const form = await request.formData();
  const nickname = cleanText(form.get('nickname'), 80);
  const upiId = cleanText(form.get('upi_id'), 320).toLowerCase();
  const payeeName = cleanText(form.get('payee_name'), 120);
  if (!nickname) return NextResponse.json({ error: 'Nickname is required.' }, { status: 400 });
  if (!payeeName) return NextResponse.json({ error: 'Payee name is required.' }, { status: 400 });
  if (!UPI_RE.test(upiId)) return NextResponse.json({ error: 'Enter a valid UPI ID, for example name@bank.' }, { status: 400 });

  const removeQr = form.get('remove_qr') === 'true';
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
  if (wantsDefault && !existing.is_default) {
    await admin.from('manual_payment_methods').update({ is_default: false }).eq('is_default', true);
  }
  const payload = {
    nickname,
    upi_id: upiId,
    payee_name: payeeName,
    instructions: cleanText(form.get('instructions'), 1000) || null,
    is_enabled: true,
    is_default: wantsDefault || !!existing.is_default,
    qr_image_url: qr ? qr.url : removeQr ? null : existing.qr_image_url,
    qr_image_public_id: qr ? qr.publicId : removeQr ? null : existing.qr_image_public_id,
    updated_by: auth.user.id,
  };
  const { data, error } = await admin.from('manual_payment_methods').update(payload).eq('id', params.id).select('*').single();
  if (error) {
    await deleteQr(qr?.publicId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (qr || removeQr) await deleteQr(existing.qr_image_public_id);
  return NextResponse.json({ success: true, method: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin.from('manual_payment_methods').select('*').eq('id', params.id).single();
  if (existingError || !existing) return NextResponse.json({ error: 'Payment method not found.' }, { status: 404 });
  const { error } = await admin.from('manual_payment_methods').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await deleteQr(existing.qr_image_public_id);
  if (existing.is_default) await normalizeDefault(admin);
  return NextResponse.json({ success: true });
}
