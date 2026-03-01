-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload payment screenshots
CREATE POLICY "Users can upload their own payment screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow admins to view all payment screenshots
CREATE POLICY "Admins can view all payment screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-screenshots' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create policy to allow users to view their own payment screenshots
CREATE POLICY "Users can view their own payment screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

