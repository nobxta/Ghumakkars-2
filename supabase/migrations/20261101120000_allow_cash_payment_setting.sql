-- Add allow_cash_payment column to payment_settings
ALTER TABLE public.payment_settings
ADD COLUMN IF NOT EXISTS allow_cash_payment BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.payment_settings.allow_cash_payment IS 'Toggle whether Pay in Person (offline/cash) is enabled on customer booking checkout.';
