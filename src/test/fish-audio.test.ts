import { describe, expect, it } from 'vitest';
import { speechBody } from '@/lib/fish-audio';

describe('Fish Audio multilingual requests', () => {
  it('keeps Hebrew text and language in the free model request', () => {
    const body = speechBody('שלום, מה שלומך?', 'he');
    expect(body).toMatchObject({ model: 'fish-audio/s2.1-pro-free:free', input: 'שלום, מה שלומך?', language: 'he' });
  });
  it('uses the translated language rather than an options override', () => {
    expect(speechBody('Bonjour', 'fr', undefined, 1, { language: 'en' })).toMatchObject({ input: 'Bonjour', language: 'fr' });
  });
});