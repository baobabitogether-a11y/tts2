export const FISH_MODEL = 'fish-audio/s2.1-pro-free:free';
export const speechLanguages = [
  ['en', 'English'], ['fr', 'French'], ['it', 'Italian'], ['he', 'Hebrew'],
  ['es', 'Spanish'], ['de', 'German'], ['pt', 'Portuguese'], ['ar', 'Arabic'],
  ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['ru', 'Russian'],
  ['hi', 'Hindi'], ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'],
] as const;

export function speechBody(text: string, lang: string, voice?: string, speed?: number, options?: Record<string, unknown>) {
  const model = typeof options?.['model'] === 'string' ? options['model'] : FISH_MODEL;
  return { ...options, input: text, model, response_format: 'mp3', speed: speed ?? 1,
    voice: voice || 'b347db033a6549378b48d00acb0d06cd',
    ...(model.startsWith('fish-audio/') ? { language: lang } : {}),
  };
}