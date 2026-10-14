-- One-time data correction after fixing the admin seat/payment bugs.
--
-- 1) trips.current_participants drifted (e.g. Manali Kasol stored 15 seats while
--    its seat-holding bookings add up to 17). Recount from the bookings that hold
--    a seat — the same statuses the admin code now uses everywhere.
update public.trips t
set current_participants = coalesce(s.pax, 0),
    updated_at = now()
from (
  select tr.id,
         (select sum(coalesce(b.number_of_participants, 1))
            from public.bookings b
           where b.trip_id = tr.id
             and b.booking_status in ('confirmed', 'seat_locked', 'on_trip', 'completed', 'referred')) as pax
  from public.trips tr
) s
where s.id = t.id
  and coalesce(t.current_participants, 0) is distinct from coalesce(s.pax, 0);

-- 2) bookings.amount_paid is a mirror of the payment ledger. A few partner
--    bookings show 0 although payments were recorded. Recompute it from the
--    ledger for bookings that have ledger rows.
update public.bookings b
set amount_paid = greatest(0, l.paid - l.refunded)
from (
  select booking_id,
         sum(case when payment_status in ('verified', 'partially_refunded', 'refunded') then coalesce(amount, 0) else 0 end) as paid,
         sum(coalesce(amount_refunded, 0)) as refunded
  from public.payment_transactions
  group by booking_id
) l
where l.booking_id = b.id
  and abs(coalesce(b.amount_paid, 0) - greatest(0, l.paid - l.refunded)) > 1;
