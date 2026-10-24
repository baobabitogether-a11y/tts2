import type { Database } from '@/integrations/supabase/types';

export const QUARANTINE_AFTER = 10;
export const QUARANTINE_MS = 15 * 60 * 1000;
type Row = Database['public']['Tables']['openrouter_keys']['Row'];
const encoder = new TextEncoder();
const bytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const base64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

async function encryptionKey() {
  const secret = process.env['OPENROUTER_KEY_ENCRYPTION_SECRET'];
  if (!secret) throw new Error('Key encryption is not configured');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(value));
  return `${base64(iv)}.${base64(new Uint8Array(result))}`;
}
export async function decryptKey(row: Row) {
  const [iv, ciphertext] = row.ciphertext.split('.');
  if (!iv || !ciphertext) throw new Error('Invalid encrypted key');
  const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await encryptionKey(), bytes(ciphertext));
  return new TextDecoder().decode(result);
}
async function fingerprint(value: string) {
  // Internal keyed digest for deduplication; never returned to clients.
  const key = await crypto.subtle.importKey('raw', encoder.encode(process.env['OPENROUTER_KEY_ENCRYPTION_SECRET'] || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
export function environmentKeys() {
  return [...new Set([process.env['OPENROUTER_API_KEY'] || '', ...(process.env['OPENROUTER_API_KEYS'] || '').split(/[\s,]+/)].map(k => k.trim()).filter(Boolean))];
}
export async function authorizeManagement(request: Request) {
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  const allowed = [process.env['OPENROUTER_MANAGEMENT_TOKEN'] || '', ...environmentKeys()].filter(Boolean);
  if (!supplied || !allowed.length) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(supplied)));
  for (const value of allowed) {
    const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
    let difference = 0;
    for (let i = 0; i < digest.length; i++) difference |= (digest[i] ?? 0) ^ (expected[i] ?? 0);
    if (difference === 0) return true;
  }
  return false;
}
export async function addKey(value: string, source = 'saved') {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const key = value.trim();
  const { error } = await supabaseAdmin.from('openrouter_keys').insert({ fingerprint: await fingerprint(key), ciphertext: await encrypt(key), source });
  if (error?.code === '23505') return false;
  if (error) throw new Error('Could not save OpenRouter key');
  return true;
}
export async function poolRows() {
  for (const key of environmentKeys()) await addKey(key, 'env');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('openrouter_keys').select('*').order('created_at');
  if (error) throw new Error('Could not load OpenRouter keys');
  return data || [];
}
export function publicKey(row: Row) {
  const until = row.quarantined_until ? Date.parse(row.quarantined_until) : undefined;
  return { id: row.id, key: 'Configured key', source: row.source, status: until && until > Date.now() ? 'quarantined' : row.status === 'quarantined' ? 'unknown' : row.status, code: row.code, failures: row.failures, lastUsed: row.last_used ? Date.parse(row.last_used) : undefined, quarantinedUntil: until };
}
export async function listKeys() { return (await poolRows()).map(publicKey); }
export async function availableKeys() {
  const all = await poolRows();
  if (!all.length) return { all, live: [] };
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('reserve_openrouter_keys');
  if (error) throw new Error('Could not reserve OpenRouter keys');
  return { all, live: data || [] };
}
export async function markKey(id: string, code: number) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.rpc('mark_openrouter_key', { key_id: id, response_code: code });
  if (error) throw new Error('Could not save OpenRouter status');
}
export async function removeKey(id: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('openrouter_keys').delete().eq('id', id).neq('source', 'env').select('id');
  if (error) throw new Error('Could not remove OpenRouter key');
  return Boolean(data?.length);
}
export async function resetKey(id: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('openrouter_keys').update({ status: 'unknown', code: null, failures: 0, quarantined_until: null }).eq('id', id).select('id');
  if (error) throw new Error('Could not reset OpenRouter status');
  return Boolean(data?.length);
}