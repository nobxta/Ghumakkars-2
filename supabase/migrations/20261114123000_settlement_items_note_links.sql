-- Settlement rows whose payment has no payment_transactions row (older bookings,
-- deleted bookings, QR payments) still identify their booking/customer through the
-- Razorpay order notes we set at checkout ({bookingId, userId, tripId}).

ALTER TABLE razorpay_settlement_items
  ADD COLUMN IF NOT EXISTS note_booking_id uuid,
  ADD COLUMN IF NOT EXISTS note_user_id    uuid,
  ADD COLUMN IF NOT EXISTS note_trip_id    uuid,
  ADD COLUMN IF NOT EXISTS description     text;

-- Backfill from rows already synced. The recon report returns notes as a JSON string.
UPDATE razorpay_settlement_items
  SET razorpay_raw = jsonb_set(razorpay_raw, '{notes}', (razorpay_raw->>'notes')::jsonb)
  WHERE jsonb_typeof(razorpay_raw->'notes') = 'string' AND (razorpay_raw->>'notes') LIKE '{%';
UPDATE razorpay_settlement_items SET
  note_booking_id = CASE WHEN COALESCE(razorpay_raw->'notes'->>'bookingId', razorpay_raw->>'order_receipt') ~* '^[0-9a-f-]{36}$'
                         THEN COALESCE(razorpay_raw->'notes'->>'bookingId', razorpay_raw->>'order_receipt')::uuid END,
  note_user_id    = CASE WHEN razorpay_raw->'notes'->>'userId' ~* '^[0-9a-f-]{36}$' THEN (razorpay_raw->'notes'->>'userId')::uuid END,
  note_trip_id    = CASE WHEN razorpay_raw->'notes'->>'tripId' ~* '^[0-9a-f-]{36}$' THEN (razorpay_raw->'notes'->>'tripId')::uuid END,
  description     = razorpay_raw->>'description';

DROP VIEW IF EXISTS v_settlement_items_admin;
CREATE VIEW v_settlement_items_admin
WITH (security_invoker = on) AS
SELECT
  i.id, i.settlement_id, i.entity_id, i.type, i.razorpay_payment_id, i.order_id, i.method,
  i.amount, i.fee, i.tax, i.credit, i.debit, i.on_hold,
  i.transaction_at, i.settled_at, i.description,
  COALESCE(i.settlement_utr, s.utr) AS settlement_utr,
  s.status AS settlement_status,
  pt.id AS payment_transaction_id, pt.paid_at, pt.amount AS payment_amount, pt.payment_type,
  pt.customer_name, pt.customer_email, pt.customer_phone,
  -- booking_id is set whenever we know which booking it was, even if that booking was deleted since
  COALESCE(b.id, i.note_booking_id) AS booking_id,
  (b.id IS NOT NULL) AS booking_exists,
  COALESCE(b.user_id, pt.user_id, i.note_user_id) AS user_id,
  b.booking_status,
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
LEFT JOIN LATERAL (
  SELECT y.* FROM bookings y
  WHERE y.id = pt.booking_id
     OR (pt.booking_id IS NULL AND y.id = i.note_booking_id)
     OR (pt.booking_id IS NULL AND i.note_booking_id IS NULL AND i.order_id IS NOT NULL AND y.razorpay_order_id = i.order_id)
  LIMIT 1
) b ON true
LEFT JOIN trips t ON t.id = COALESCE(b.trip_id, i.note_trip_id)
LEFT JOIN profiles p ON p.id = COALESCE(b.user_id, pt.user_id, i.note_user_id);

-- Payouts from Razorpay report fees = 0 for standard settlements (fees are charged
-- per transaction), so fill them from the transactions.
UPDATE razorpay_settlements s SET
  fees = x.fee, tax = x.tax
FROM (SELECT settlement_id, sum(fee) fee, sum(tax) tax FROM razorpay_settlement_items GROUP BY settlement_id) x
WHERE x.settlement_id = s.id AND COALESCE(s.fees, 0) = 0;
