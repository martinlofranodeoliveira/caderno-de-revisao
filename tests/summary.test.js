import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeNotebook } from '../src/summary.js';

test('conta exatamente100baralhos e5000cartões em um percurso, sem mutar o estado', () => {
  const state = { version: 1, decks: Array.from({ length: 100 }, (_, i) => ({
    id: `deck-${i}`, title: `Baralho ${i}`, cards: Array.from({ length: 50 }, (_, j) => ({
      id: `card-${j}`, front: `Pergunta ${j}: ${'x'.repeat(200)}`, back: 'Uma resposta para estudar.',
      box: j % 5 + 1, due: j % 2 ? '2026-11-09' : '2026-11-08', lastReviewed: '2026-11-01', reviews: 5,
    })),
  })) };
  const before = JSON.stringify(state);
  const result = summarizeNotebook(state, '2026-11-08');
  assert.equal(result.totalCards, 5000);
  assert.equal(Object.keys(result.dueCounts).length, 100);
  for (const deck of state.decks) {
    assert.equal(result.dueCounts[deck.id], 25);
    assert.deepEqual(result.boxCounts[deck.id], [10, 10, 10, 10, 10]);
  }
  assert.equal(JSON.stringify(state), before);
});

test('contadores usam chaves próprias mesmo quando um identificador coincide com nome de protótipo', () => {
  const result = summarizeNotebook({ version: 1, decks: [{ id: '__proto__', title: 'Teste', cards: [] }] }, '2026-11-08');
  assert.equal(result.dueCounts.__proto__, 0);
  assert.deepEqual(result.boxCounts.__proto__, [0, 0, 0, 0, 0]);
});
