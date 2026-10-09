// Shared catalog for settings and chat. Retired model IDs stay in historical messages.
export const availableModels = [
  { id: 'claude-sonnet-4-6', name: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', name: 'claude-opus-4-6', displayName: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', name: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' },
];
export const defaultModel = availableModels[0].id;
const replacements: Record<string, string> = {
  'claude-3-7-sonnet-20250219': defaultModel,
  'claude-3-5-sonnet-20240620': defaultModel,
  'claude-3-sonnet-20240229': defaultModel,
  'claude-3-opus-20240229': 'claude-opus-4-6',
  'claude-3-haiku-20240307': 'claude-haiku-4-5-20251001',
};
export function normalizeModel(id: string): string {
  return replacements[id] || id;
}
