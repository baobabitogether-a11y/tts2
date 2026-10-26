import type { Database } from '@/integrations/supabase/types';

export const QUARANTINE_AFTER = 10;
export const QUARANTINE_MS = 15 * 60 * 1000;
export type KeyService = 'openrouter' | 'lovable';
type Row = Database['public']['Tables']['provider_api_keys']['Row'];
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
export function environmentKeys(service: KeyService = 'openrouter') {
  const values = service === 'openrouter'
    ? [process.env['OPENROUTER_API_KEY'] || '', ...(process.env['OPENROUTER_API_KEYS'] || '').split(/[\s,]+/)]
    : [process.env['LOVABLE_API_KEY'] || '', ...(process.env['LOVABLE_API_KEYS'] || '').split(/[\s,]+/)];
  return [...new Set(values.map(k => k.trim()).filter(Boolean))];
}
export async function authorizeManagement(request: Request) {
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  const allowed = [process.env['PROVIDER_MANAGEMENT_TOKEN'] || process.env['OPENROUTER_MANAGEMENT_TOKEN'] || '', ...environmentKeys('openrouter'), ...environmentKeys('lovable')].filter(Boolean);
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
export function addKey(value: string, source?: string): Promise<boolean>;
export function addKey(service: KeyService, value: string, source?: string): Promise<boolean>;
export async function addKey(serviceOrValue: string, valueOrSource = 'saved', source = 'saved') {
  const hasService = serviceOrValue === 'openrouter' || serviceOrValue === 'lovable';
  const service: KeyService = hasService ? serviceOrValue as KeyService : 'openrouter';
  const value = hasService ? valueOrSource : serviceOrValue;
  const keySource = hasService ? source : valueOrSource;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const key = value.trim();
  const { error } = await supabaseAdmin.from('provider_api_keys').insert({ service, fingerprint: await fingerprint(key), ciphertext: await encrypt(key), source: keySource });
  if (error?.code === '23505') return false;
  if (error) throw new Error('Could not save OpenRouter key');
  return true;
}
export async function poolRows(service?: KeyService) {
  const services = service ? [service] : ['openrouter', 'lovable'] as const;
  for (const current of services) {
    for (const key of environmentKeys(current)) await addKey(current, key, 'env');
  }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const base = supabaseAdmin.from('provider_api_keys').select('*');
  const query = service ? base.eq('service', service) : base;
  const { data, error } = await query.order('created_at');
  if (error) throw new Error('Could not load OpenRouter keys');
  return data || [];
}
export function publicKey(row: Row) {
  const until = row.quarantined_until ? Date.parse(row.quarantined_until) : undefined;
  return { id: row.id, service: row.service, key: 'Configured key', source: row.source, status: until && until > Date.now() ? 'quarantined' : row.status === 'quarantined' ? 'unknown' : row.status, code: row.code, failures: row.failures, lastUsed: row.last_used ? Date.parse(row.last_used) : undefined, quarantinedUntil: until };
}
export async function listKeys(service?: KeyService) { return (await poolRows(service)).map(publicKey); }
export async function reserveKey(service: KeyService, excluded: string[] = []) {
  const all = await poolRows(service);
  if (!all.length) return { all, key: null };
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.rpc('reserve_provider_key', { service_name: service, excluded_keys: excluded });
  if (error) throw new Error('Could not reserve provider keys');
  return { all, key: data?.[0] || null };
}
export async function markKey(id: string, code: number) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.rpc('mark_provider_key', { key_id: id, response_code: code });
  if (error) throw new Error('Could not save provider key status');
}
export async function removeKey(id: string, service?: KeyService) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  let query = supabaseAdmin.from('provider_api_keys').delete().eq('id', id).neq('source', 'env');
  if (service) query = query.eq('service', service);
  const { data, error } = await query.select('id');
  if (error) throw new Error('Could not remove OpenRouter key');
  return Boolean(data?.length);
}
export async function resetKey(id: string, service?: KeyService) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  let query = supabaseAdmin.from('provider_api_keys').update({ status: 'unknown', code: null, failures: 0, quarantined_until: null }).eq('id', id);
  if (service) query = query.eq('service', service);
  const { data, error } = await query.select('id');
  if (error) throw new Error('Could not reset OpenRouter status');
  return Boolean(data?.length);
}