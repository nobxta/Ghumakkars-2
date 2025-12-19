import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    // Debug logging (remove in production)
    console.log('Cloudinary Config Check:', {
      hasCloudName: !!cloudName,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      cloudNameValue: cloudName || 'MISSING',
    });

    if (!cloudName || !apiKey || !apiSecret) {
      const missing = [];
      if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
      if (!apiKey) missing.push('CLOUDINARY_API_KEY');
      if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');
      
      console.error('Missing Cloudinary environment variables:', missing);
      return NextResponse.json(
        { 
          error: 'Cloudinary credentials not configured',
          missing: missing,
          message: `Please add the following environment variables to .env.local: ${missing.join(', ')}`
        },
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
    const params: Record<string, string> = {
      timestamp: timestamp.toString(),
      folder: 'payment_qr', // Organize QR codes in a folder
    };

    // Create signature string
    const signatureParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
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
    uploadFormData.append('folder', 'payment_qr');

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
        { error: 'Failed to upload image to Cloudinary' },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      url: data.secure_url,
      public_id: data.public_id,
    });
  } catch (error: any) {
    console.error('Error uploading to Cloudinary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
