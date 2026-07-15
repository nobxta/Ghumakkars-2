# WhatsApp Auto-Logout Audit

Date: 2026-07-15

## Evidence reviewed

- Pterodactyl startup log from the pasted attachment.
- `whatsapp-worker/index.mjs`
- `app/api/admin/whatsapp/route.ts`
- `lib/whatsapp.ts`
- Worker dependency metadata for `@whiskeysockets/baileys`.

## Finding

The worker was not intentionally logging out during normal notification usage.
The only code path that calls `sock.logout()` and deletes
`data/whatsapp-session` is the manual worker `POST /logout` handler.

The pasted log shows this sequence:

```text
restartRequired -> reconnect OK
connectionClosed -> reconnect OK
connectionClosed -> reconnect OK
badSession -> relink required
```

That means the real failure is a Baileys/WhatsApp session rejection after
several transient stream closes. In the previous worker logic, `badSession` and
`loggedOut` were treated as final states immediately, so the worker reported
the session as logged out even though the code did not press logout.

## Most likely causes

1. Another worker/process/container using the same saved Baileys auth folder or
   same copied session. A local process lock only protects one filesystem volume.
2. WhatsApp replacing the linked device session after a protocol/session
   mismatch.
3. Running an odd/current Node runtime (`v25.9.0` in the pasted log) instead of
   a stable LTS runtime increases risk with unofficial WhatsApp automation
   libraries, even though Baileys only enforces Node 20+.
4. Keeping another automation/browser open against the same linked device can
   trigger replacement-style disconnects.

## Fix applied

- Added persistent JSONL logs at
  `data/logs/whatsapp-worker.jsonl`, with size-based rotation.
- Added authenticated log inspection via `GET /logs?limit=200`.
- Logged login, manual logout, send attempts, queueing, connection states,
  disconnect reasons, credential saves, and startup diagnostics.
- Changed remote `loggedOut`, `badSession`, and `connectionReplaced` handling
  to preserve auth files and keep reconnecting.
- Kept actual logout and auth deletion restricted to manual `POST /logout` or
  explicit forced relink.
- Added retry scheduling for startup failures so the worker cannot remain stuck
  in `starting`.

## Operational checks

Run only one active worker for this WhatsApp number. If multiple Pterodactyl
servers or copied volumes exist, stop all but one.

Use:

```bash
curl -H "x-api-key: $VPS_API_SECRET" "https://api.ghumakkars.in/logs?limit=200"
```

After the next disconnect, inspect the latest `whatsapp_disconnected`,
`remote_logged_out_ignored`, `bad_session_observed`, or
`connection_replaced_duplicate_client` entry.
