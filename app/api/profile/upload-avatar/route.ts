import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary credentials not configured' },
        { status: 500 }
      );
    }

    // Convert file to base64 data URI
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    // Generate timestamp
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Create signature for signed upload
    // IMPORTANT: All parameters sent to Cloudinary (except file and signature) must be included in signature
    const params: Record<string, string> = {
      timestamp: timestamp.toString(),
      folder: 'avatars', // Organize avatars in a folder
      public_id: `avatar_${user.id}`, // Use user ID for consistent naming
      overwrite: 'true', // Overwrite existing avatar - MUST be included in signature
    };

    // Create signature string - sort keys alphabetically and join with &
    const signatureParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Append API secret to the signature string
    const signatureString = signatureParams + apiSecret;
    const signature = crypto
      .createHash('sha1')
      .update(signatureString)
      .digest('hex');

    // Upload to Cloudinary using signed upload
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    
    const uploadFormData = new URLSearchParams();
    uploadFormData.append('file', dataUri);
    uploadFormData.append('api_key', apiKey);
    uploadFormData.append('timestamp', timestamp.toString());
    uploadFormData.append('signature', signature);
    uploadFormData.append('folder', 'avatars');
    uploadFormData.append('public_id', `avatar_${user.id}`);
    uploadFormData.append('overwrite', 'true'); // Overwrite existing avatar

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: uploadFormData.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Cloudinary upload error:', error);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Update profile with avatar URL
    const adminClient = createAdminClient();
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ avatar_url: data.secure_url })
      .eq('id', user.id);

    if (profileError) {
      console.error('Error updating profile avatar:', profileError);
      // Still return success since upload succeeded
    }

    return NextResponse.json({
      url: data.secure_url,
      public_id: data.public_id,
    });
  } catch (error: any) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}

