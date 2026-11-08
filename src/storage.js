import { createNotebook, parseNotebook, serializeNotebook } from './engine.js';

export const STORAGE_KEY = 'lofrano.caderno.v1';

export function loadStorage(provided) {
  let storage;
  let raw = null;
  try {
    storage = provided === undefined ? window.localStorage : provided;
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { notebook: createNotebook(), storage: null, raw: null, expectedRaw: null, blocked: false, warning: 'O armazenamento não está disponível. Esta sessão fica apenas na memória; exporte um backup antes de sair.' };
  }
  if (raw === null) return { notebook: createNotebook(), storage, raw, expectedRaw: raw, blocked: false, warning: '' };
  try {
    return { notebook: parseNotebook(raw), storage, raw: null, expectedRaw: raw, blocked: false, warning: '' };
  } catch {
    return { notebook: createNotebook(), storage, raw, expectedRaw: raw, blocked: true, warning: 'Os dados locais não puderam ser abertos. Eles foram preservados. Baixe o arquivo de recuperação antes de removê-los ou importar outro caderno.' };
  }
}

export function compareStorage(storage, expectedRaw) {
  try {
    if (!storage) throw new Error('unavailable');
    return { status: storage.getItem(STORAGE_KEY) === expectedRaw ? 'unchanged' : 'conflict' };
  } catch {
    return { status: 'unavailable' };
  }
}

// Without Web Locks this is an optimistic guard, not an atomic transaction.
// Serialize first, then compare immediately before the synchronous write.
export function saveStorage(storage, notebook, expectedRaw) {
  const raw = serializeNotebook(notebook);
  const guard = compareStorage(storage, expectedRaw);
  if (guard.status !== 'unchanged') return guard;
  try {
    storage.setItem(STORAGE_KEY, raw);
    return { status: 'saved', raw };
  } catch {
    return { status: 'unavailable' };
  }
}

export function clearStorage(storage, expectedRaw) {
  const guard = compareStorage(storage, expectedRaw);
  if (guard.status !== 'unchanged') return guard;
  try {
    storage.removeItem(STORAGE_KEY);
    return { status: 'saved', raw: null };
  } catch {
    return { status: 'unavailable' };
  }
}
