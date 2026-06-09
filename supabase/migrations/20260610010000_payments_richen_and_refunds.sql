-- Enrich payment_transactions with full Razorpay payment fields + add payment_refunds table.
-- Applied to production DB via Supabase MCP on 2026-06-10. This file is for repo history / fresh restores.

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS razorpay_order_id   varchar(64),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id varchar(64),
  ADD COLUMN IF NOT EXISTS currency            varchar(8)  DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS payment_method      varchar(32),
  ADD COLUMN IF NOT EXISTS captured            boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS vpa                 varchar(128),
  ADD COLUMN IF NOT EXISTS upi_provider        varchar(64),
  ADD COLUMN IF NOT EXISTS card_network        varchar(32),
  ADD COLUMN IF NOT EXISTS card_type           varchar(16),
  ADD COLUMN IF NOT EXISTS card_last4          varchar(4),
  ADD COLUMN IF NOT EXISTS card_issuer         varchar(64),
  ADD COLUMN IF NOT EXISTS bank                varchar(64),
  ADD COLUMN IF NOT EXISTS wallet              varchar(64),
  ADD COLUMN IF NOT EXISTS customer_name       varchar(255),
  ADD COLUMN IF NOT EXISTS customer_email      varchar(255),
  ADD COLUMN IF NOT EXISTS customer_phone      varchar(32),
  ADD COLUMN IF NOT EXISTS paid_at             timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_raw        jsonb,
  ADD COLUMN IF NOT EXISTS amount_refunded     numeric(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pt_razorpay_payment_id ON payment_transactions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_pt_booking_id          ON payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_pt_user_id             ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_payment_status      ON payment_transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_pt_paid_at             ON payment_transactions(paid_at DESC);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id           uuid NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  razorpay_refund_id   varchar(64) UNIQUE,
  amount               numeric(12,2) NOT NULL CHECK (amount > 0),
  currency             varchar(8) DEFAULT 'INR',
  status               varchar(32) NOT NULL DEFAULT 'pending',
  reason               text,
  notes                jsonb,
  processed_at         timestamptz,
  initiated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  razorpay_raw         jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_payment_id  ON payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_pr_rzp_refund  ON payment_refunds(razorpay_refund_id);
CREATE INDEX IF NOT EXISTS idx_pr_status      ON payment_refunds(status);

CREATE OR REPLACE FUNCTION touch_payment_refunds_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_payment_refunds_touch ON payment_refunds;
CREATE TRIGGER tr_payment_refunds_touch BEFORE UPDATE ON payment_refunds
  FOR EACH ROW EXECUTE FUNCTION touch_payment_refunds_updated_at();

ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refunds_admin_all ON payment_refunds;
CREATE POLICY refunds_admin_all ON payment_refunds FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS refunds_owner_read ON payment_refunds;
CREATE POLICY refunds_owner_read ON payment_refunds FOR SELECT
  USING (
    payment_id IN (
      SELECT pt.id FROM payment_transactions pt
      JOIN bookings b ON b.id = pt.booking_id
      WHERE b.user_id = auth.uid()
    )
  );

CREATE OR REPLACE VIEW v_payments_admin AS
SELECT
  pt.id, pt.booking_id, pt.user_id,
  pt.razorpay_order_id, pt.razorpay_payment_id, pt.transaction_id,
  pt.amount, pt.amount_refunded, pt.currency,
  pt.payment_status, pt.payment_type, pt.payment_mode, pt.payment_method, pt.captured,
  pt.vpa, pt.upi_provider,
  pt.card_network, pt.card_type, pt.card_last4, pt.card_issuer,
  pt.bank, pt.wallet,
  pt.customer_name, pt.customer_email, pt.customer_phone,
  pt.paid_at, pt.created_at, pt.updated_at,
  b.booking_status, b.primary_passenger_name, b.primary_passenger_email, b.primary_passenger_phone,
  t.id AS trip_id, t.title AS trip_title, t.destination AS trip_destination
FROM payment_transactions pt
LEFT JOIN bookings b ON b.id = pt.booking_id
LEFT JOIN trips t ON t.id = b.trip_id;
