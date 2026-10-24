// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

const durable = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {
  from: () => ({
    insert: async (row: Record<string, unknown>) => {
      durable.rows.push({ ...row, id: 'independent-row-id', status: 'blocked', failures: 3, code: 401, quarantined_until: null });
      return { error: null };
    },
    select: () => ({ order: async () => ({ data: durable.rows, error: null }) }),
  }),
} }));
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubEnv('OPENROUTER_KEY_ENCRYPTION_SECRET', 'test-encryption-only-not-a-provider-credential');
  vi.stubEnv('OPENROUTER_API_KEY', '');
  vi.stubEnv('OPENROUTER_API_KEYS', '');
  durable.rows.length = 0;
});
describe('durable key storage', () => {
  it('reads the saved key and status after all pool modules are reloaded', async () => {
    const pool = await import('@/lib/openrouter-pool.server');
    await pool.addKey('synthetic-test-value');
    expect(durable.rows[0]?.ciphertext).not.toContain('synthetic-test-value');
    vi.resetModules();
    const reloaded = await import('@/lib/openrouter-pool.server');
    const rows = await reloaded.poolRows();
    const first = rows[0];
    if (!first) throw new Error('Saved key was lost');
    expect(await reloaded.decryptKey(first)).toBe('synthetic-test-value');
    expect(reloaded.publicKey(first)).toMatchObject({ status: 'blocked', failures: 3, code: 401 });
  });
  it('rejects key management without a server-verified token', async () => {
    const pool = await import('@/lib/openrouter-pool.server');
    expect(await pool.authorizeManagement(new Request('http://localhost'))).toBe(false);
  });
});