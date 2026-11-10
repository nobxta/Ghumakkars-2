-- The DB outbox queue was replaced by direct HTTP calls from the website to the
-- self-hosted Baileys worker (commit 0479e61). Nothing reads or writes it now.
drop table if exists public.whatsapp_outbox;
