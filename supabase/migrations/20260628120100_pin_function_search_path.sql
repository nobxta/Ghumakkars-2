-- Hardening (Supabase advisor: function_search_path_mutable): pin search_path so
-- these functions can't be hijacked via a mutable search_path. All 15 reference
-- only public-schema objects with unqualified names (verified) and pg_catalog is
-- always implicitly searched first, so behaviour is unchanged.
alter function public.cleanup_expired_otps() set search_path = public;
alter function public.credit_wallet(p_user_id uuid, p_amount numeric, p_description text, p_reference_type character varying, p_reference_id uuid) set search_path = public;
alter function public.debit_wallet(p_user_id uuid, p_amount numeric, p_description text, p_reference_type character varying, p_reference_id uuid) set search_path = public;
alter function public.generate_referral_code() set search_path = public;
alter function public.increment_coupon_usage(coupon_id_param uuid) set search_path = public;
alter function public.increment_trip_participants(trip_id uuid, increment_by integer) set search_path = public;
alter function public.process_pending_referrals_for_bookings() set search_path = public;
alter function public.process_referral_reward(p_booking_id uuid) set search_path = public;
alter function public.publish_scheduled_trips() set search_path = public;
alter function public.touch_payment_refunds_updated_at() set search_path = public;
alter function public.update_coupon_codes_updated_at() set search_path = public;
alter function public.update_payment_settings_updated_at() set search_path = public;
alter function public.update_referrals_updated_at() set search_path = public;
alter function public.update_trip_status() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
