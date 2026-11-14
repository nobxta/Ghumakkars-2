-- Razorpay settlements: the payouts Razorpay sends to our bank, and the per-transaction
-- breakdown (which payment / refund went into which payout, with fee + GST).
-- Filled by lib/razorpay-settlements.ts (admin "Sync" button, auto-sync, and the
-- settlement.processed webhook). Linked to payments → bookings → users at read time
-- through v_settlement_items_admin, so payments recorded later still match.

CREATE TABLE IF NOT EXISTS razorpay_settlements (
  id            varchar(64) PRIMARY KEY,               -- setl_…
  amount        numeric(12,2) NOT NULL DEFAULT 0,      -- net amount credited to the bank
  fees          numeric(12,2) NOT NULL DEFAULT 0,      -- fee + tax deducted
  tax           numeric(12,2) NOT NULL DEFAULT 0,      -- GST part of fees
  utr           varchar(64),                           -- bank reference
  status        varchar(32),                           -- created | processed | failed
  settled_at    timestamptz,                           -- when Razorpay created the payout
  razorpay_raw  jsonb,
  synced_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rs_settled_at ON razorpay_settlements(settled_at DESC);

CREATE TABLE IF NOT EXISTS razorpay_settlement_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id       varchar(64) NOT NULL REFERENCES razorpay_settlements(id) ON DELETE CASCADE,
  entity_id           varchar(64) NOT NULL,            -- pay_… / rfnd_… / adj_…
  type                varchar(32) NOT NULL,            -- payment | refund | adjustment | …
  razorpay_payment_id varchar(64),                     -- the payment this row belongs to (refunds too)
  order_id            varchar(64),
  method              varchar(32),
  amount              numeric(12,2) NOT NULL DEFAULT 0, -- transaction amount
  fee                 numeric(12,2) NOT NULL DEFAULT 0, -- fee incl. tax
  tax                 numeric(12,2) NOT NULL DEFAULT 0,
  credit              numeric(12,2) NOT NULL DEFAULT 0, -- what this row added to the payout
  debit               numeric(12,2) NOT NULL DEFAULT 0, -- what this row took off the payout
  on_hold             boolean NOT NULL DEFAULT false,
  transaction_at      timestamptz,                      -- when the payment/refund happened
  settled_at          timestamptz,
  settlement_utr      varchar(64),
  razorpay_raw        jsonb,
  synced_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, entity_id, type)
);
CREATE INDEX IF NOT EXISTS idx_rsi_payment ON razorpay_settlement_items(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_rsi_settlement ON razorpay_settlement_items(settlement_id);

-- One row: when settlements were last pulled from Razorpay.
CREATE TABLE IF NOT EXISTS razorpay_settlement_sync (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_synced_at  timestamptz,
  last_from       timestamptz,
  last_to         timestamptz,
  last_error      text,
  settlements     int,
  items           int
);

ALTER TABLE razorpay_settlements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE razorpay_settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE razorpay_settlement_sync  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rs_admin_read ON razorpay_settlements;
CREATE POLICY rs_admin_read ON razorpay_settlements FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS rsi_admin_read ON razorpay_settlement_items;
CREATE POLICY rsi_admin_read ON razorpay_settlement_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS rss_admin_read ON razorpay_settlement_sync;
CREATE POLICY rss_admin_read ON razorpay_settlement_sync FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Each settled transaction with its payout, payment, booking, trip and customer.
CREATE OR REPLACE VIEW v_settlement_items_admin
WITH (security_invoker = on) AS
SELECT
  i.id, i.settlement_id, i.entity_id, i.type, i.razorpay_payment_id, i.order_id, i.method,
  i.amount, i.fee, i.tax, i.credit, i.debit, i.on_hold,
  i.transaction_at, i.settled_at,
  COALESCE(i.settlement_utr, s.utr) AS settlement_utr,
  s.status AS settlement_status,
  pt.id AS payment_transaction_id, pt.paid_at, pt.amount AS payment_amount, pt.payment_type,
  pt.customer_name, pt.customer_email, pt.customer_phone,
  b.id AS booking_id, b.user_id, b.booking_status,
  b.primary_passenger_name, b.primary_passenger_email, b.primary_passenger_phone,
  t.id AS trip_id, t.title AS trip_title,
  p.full_name AS profile_name, p.first_name AS profile_first_name, p.last_name AS profile_last_name,
  p.email AS profile_email, p.phone AS profile_phone, p.avatar_url AS profile_avatar_url
FROM razorpay_settlement_items i
JOIN razorpay_settlements s ON s.id = i.settlement_id
LEFT JOIN LATERAL (
  SELECT x.* FROM payment_transactions x
  WHERE i.razorpay_payment_id IS NOT NULL
    AND (x.razorpay_payment_id = i.razorpay_payment_id OR x.transaction_id = i.razorpay_payment_id)
  ORDER BY x.created_at
  LIMIT 1
) pt ON true
LEFT JOIN bookings b ON b.id = pt.booking_id
LEFT JOIN trips t ON t.id = b.trip_id
LEFT JOIN profiles p ON p.id = COALESCE(b.user_id, pt.user_id);
