/**
 * Baileys auth state stored in Supabase (table `whatsapp_auth`) instead of
 * files, so the WhatsApp login survives container redeploys.
 *
 * Drop-in replacement for Baileys' `useMultiFileAuthState`. Also holds the
 * single-server lease (`whatsapp_lease`) helpers. Server-only.
 */
import { createAdminClient } from '../supabase/admin';

const TABLE = 'whatsapp_auth';
const READ_CHUNK = 100;
const WRITE_CHUNK = 200;

let client: ReturnType<typeof createAdminClient> | null = null;
const db = () => (client ??= createAdminClient());

async function baileysUtils() {
  const mod: any = await import('@whiskeysockets/baileys');
  return {
    BufferJSON: mod.BufferJSON ?? mod.default?.BufferJSON,
    initAuthCreds: mod.initAuthCreds ?? mod.default?.initAuthCreds,
    proto: mod.proto ?? mod.default?.proto,
  };
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < attempts) await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  throw new Error(`${label}: ${(last as any)?.message || String(last)}`);
}

export interface SupabaseAuthStore {
  state: { creds: any; keys: any };
  saveCreds: () => Promise<void>;
  /** Stop writing (socket is being thrown away) and wait for pending writes. */
  close: () => Promise<void>;
}

export async function loadSupabaseAuthState(): Promise<SupabaseAuthStore> {
  const { BufferJSON, initAuthCreds, proto } = await baileysUtils();
  const encode = (v: unknown) => JSON.stringify(v, BufferJSON.replacer);
  const decode = (s: string) => JSON.parse(s, BufferJSON.reviver);

  // Writes run one after another so a later save never lands before an earlier one.
  let chain: Promise<unknown> = Promise.resolve();
  let closed = false;
  const serial = (fn: () => Promise<void>) => {
    const p = chain.then(fn, fn);
    chain = p.catch(() => {});
    return p;
  };

  async function readMany(keys: string[]) {
    await chain; // see our own pending writes
    const out = new Map<string, any>();
    for (let i = 0; i < keys.length; i += READ_CHUNK) {
      const part = keys.slice(i, i + READ_CHUNK);
      const { data, error } = await withRetry('whatsapp_auth read', async () => {
        const r = await db().from(TABLE).select('key,value').in('key', part);
        if (r.error) throw new Error(r.error.message);
        return r;
      });
      if (error) throw new Error(error.message);
      for (const row of data ?? []) out.set(row.key, decode(row.value));
    }
    return out;
  }

  function writeMany(upserts: { key: string; value: string }[], deletes: string[]) {
    return serial(async () => {
      if (closed) return;
      const now = new Date().toISOString();
      for (let i = 0; i < upserts.length; i += WRITE_CHUNK) {
        const rows = upserts.slice(i, i + WRITE_CHUNK).map((r) => ({ ...r, updated_at: now }));
        await withRetry('whatsapp_auth write', async () => {
          const { error } = await db().from(TABLE).upsert(rows, { onConflict: 'key' });
          if (error) throw new Error(error.message);
        });
      }
      for (let i = 0; i < deletes.length; i += READ_CHUNK) {
        const part = deletes.slice(i, i + READ_CHUNK);
        await withRetry('whatsapp_auth delete', async () => {
          const { error } = await db().from(TABLE).delete().in('key', part);
          if (error) throw new Error(error.message);
        });
      }
    });
  }

  const saved = (await readMany(['creds'])).get('creds');
  const creds = saved || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const found = await readMany(ids.map((id) => `${type}-${id}`));
          const data: Record<string, any> = {};
          for (const id of ids) {
            let value = found.get(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
            data[id] = value;
          }
          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const upserts: { key: string; value: string }[] = [];
          const deletes: string[] = [];
          for (const type of Object.keys(data)) {
            for (const id of Object.keys(data[type] || {})) {
              const value = data[type][id];
              const key = `${type}-${id}`;
              if (value) upserts.push({ key, value: encode(value) });
              else deletes.push(key);
            }
          }
          await writeMany(upserts, deletes);
        },
      },
    },
    saveCreds: () => writeMany([{ key: 'creds', value: encode(creds) }], []),
    close: async () => {
      await chain;
      closed = true;
    },
  };
}

/** True when a WhatsApp login is saved in the database. */
export async function hasSavedAuth(): Promise<boolean> {
  const { data, error } = await db().from(TABLE).select('key').eq('key', 'creds').maybeSingle();
  if (error) throw new Error(`whatsapp_auth read: ${error.message}`);
  return !!data;
}

/** Delete the saved WhatsApp login (logout / relink). */
export async function clearSavedAuth(): Promise<void> {
  await withRetry('whatsapp_auth clear', async () => {
    const { error } = await db().from(TABLE).delete().neq('key', '');
    if (error) throw new Error(error.message);
  });
}

// ── Single-server lease ───────────────────────────────────────────────────
export async function acquireLease(owner: string, staleSeconds: number): Promise<boolean> {
  const { data, error } = await db().rpc('whatsapp_acquire_lease', { p_owner: owner, p_stale_seconds: staleSeconds });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function releaseLease(owner: string): Promise<void> {
  const { error } = await db().rpc('whatsapp_release_lease', { p_owner: owner });
  if (error) throw new Error(error.message);
}
