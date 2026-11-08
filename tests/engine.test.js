import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDeck, createNotebook, dueCards, parseNotebook, removeCard, removeDeck,
  renameDeck, reviewCard, serializeNotebook, upsertCard, validateNotebook,
} from '../src/engine.js';

const TODAY = '2026-11-08';
const card = (id = 'one', changes = {}) => ({
  id, front: 'Pergunta', back: 'Resposta', box: 1, due: TODAY,
  lastReviewed: null, reviews: 0, ...changes,
});
const notebook = (cards = [card()]) => ({
  version: 1, decks: [{ id: 'study', title: 'Estudo', cards }],
});
const error = (code, operation) => assert.throws(operation, (caught) => {
  assert.equal(caught.code, code);
  assert.equal(caught.message, code);
  return true;
});
const frozen = (value) => {
  for (const item of Object.values(value)) {
    if (item && typeof item === 'object') frozen(item);
  }
  return Object.freeze(value);
};

test('creates independent empty notebooks', () => {
  const first = createNotebook();
  const second = createNotebook();
  assert.deepEqual(first, { version: 1, decks: [] });
  first.decks.push({});
  assert.deepEqual(second, { version: 1, decks: [] });
});

test('normalizes text and returns a deep clone', () => {
  const source = frozen(notebook([card('one', { front: '  <b>literal</b>  ', back: '\tResposta\n' })]));
  const result = validateNotebook(source);
  assert.equal(result.decks[0].cards[0].front, '<b>literal</b>');
  assert.equal(result.decks[0].cards[0].back, 'Resposta');
  assert.notEqual(result, source);
  assert.notEqual(result.decks, source.decks);
  assert.notEqual(result.decks[0].cards[0], source.decks[0].cards[0]);
});

test('adds, renames and removes decks without changing the original', () => {
  const base = frozen(createNotebook());
  let result = addDeck(base, 'first', '  Primeiro  ');
  result = addDeck(result, 'second', 'Segundo');
  assert.deepEqual(result.decks.map((deck) => deck.id), ['first', 'second']);
  result = renameDeck(result, 'first', '  Novo nome  ');
  assert.equal(result.decks[0].title, 'Novo nome');
  result = removeDeck(result, 'first');
  assert.equal(result.decks[0].id, 'second');
  assert.deepEqual(base, createNotebook());
});

test('duplicate deck ID is refused', () => {
  error('DUPLICATE_ID', () => addDeck(notebook(), 'study', 'Outro'));
});

test('missing targets and malformed IDs use distinct errors', () => {
  error('NOT_FOUND', () => removeDeck(notebook(), 'missing'));
  error('NOT_FOUND', () => renameDeck(notebook(), 'missing', 'Novo'));
  error('NOT_FOUND', () => removeCard(notebook(), 'study', 'missing'));
  error('NOT_FOUND', () => dueCards(notebook(), 'missing', TODAY));
  error('INVALID_DATA', () => addDeck(createNotebook(), 'contains space', 'Estudo'));
});

test('new cards begin due today in box one', () => {
  const base = frozen(addDeck(createNotebook(), 'study', 'Estudo'));
  const result = upsertCard(base, 'study', { id: 'one', front: '  Q  ', back: ' A ' }, TODAY);
  assert.deepEqual(result.decks[0].cards[0], card('one', { front: 'Q', back: 'A' }));
  assert.deepEqual(base.decks[0].cards, []);
});

test('editing preserves all scheduling information and position', () => {
  const previous = card('one', { box: 4, reviews: 8, lastReviewed: '2026-11-01', due: '2026-11-15' });
  const base = frozen(notebook([previous, card('two')]));
  const result = upsertCard(base, 'study', { id: 'one', front: 'Nova pergunta', back: 'Nova resposta' }, TODAY);
  assert.deepEqual(result.decks[0].cards[0], { ...previous, front: 'Nova pergunta', back: 'Nova resposta' });
  assert.equal(result.decks[0].cards[1].id, 'two');
});

test('removes one card and keeps the original immutable', () => {
  const base = frozen(notebook([card('one'), card('two')]));
  assert.deepEqual(removeCard(base, 'study', 'one').decks[0].cards.map((item) => item.id), ['two']);
  assert.equal(base.decks[0].cards.length, 2);
});

test('due cards are cloned, ordered by date and stable for ties', () => {
  const base = frozen(notebook([
    card('later', { due: '2026-11-09' }), card('same-first'),
    card('old', { due: '2026-11-01' }), card('same-last'),
  ]));
  const result = dueCards(base, 'study', TODAY);
  assert.deepEqual(result.map((item) => item.id), ['old', 'same-first', 'same-last']);
  result[0].front = 'Changed';
  assert.equal(base.decks[0].cards[2].front, 'Pergunta');
  assert.deepEqual(dueCards(notebook([]), 'study', TODAY), []);
});

test('remember advances before selecting the new interval', () => {
  const base = frozen(notebook());
  const result = reviewCard(base, 'study', 'one', 'remember', TODAY).decks[0].cards[0];
  assert.deepEqual(result, card('one', { box: 2, due: '2026-11-11', lastReviewed: TODAY, reviews: 1 }));
  assert.equal(base.decks[0].cards[0].box, 1);
});

test('again returns to box one and the following day', () => {
  const base = notebook([card('one', { box: 5, lastReviewed: '2026-10-01', reviews: 7 })]);
  const result = reviewCard(base, 'study', 'one', 'again', TODAY).decks[0].cards[0];
  assert.equal(result.box, 1);
  assert.equal(result.due, '2026-11-09');
  assert.equal(result.reviews, 8);
});

test('box five is capped and keeps its thirty-day interval', () => {
  const base = notebook([card('one', { box: 5, lastReviewed: '2026-10-01', reviews: 7 })]);
  const result = reviewCard(base, 'study', 'one', 'remember', TODAY).decks[0].cards[0];
  assert.equal(result.box, 5);
  assert.equal(result.due, '2026-12-08');
});

test('calendar arithmetic handles leap years and century exceptions', () => {
  const review = (today) => reviewCard(notebook([card('one', { due: today })]), 'study', 'one', 'again', today).decks[0].cards[0].due;
  assert.equal(review('2024-02-28'), '2024-02-29');
  assert.equal(review('2024-02-29'), '2024-03-01');
  assert.equal(review('1900-02-28'), '1900-03-01');
  assert.equal(review('2000-02-28'), '2000-02-29');
  assert.equal(review('2026-12-31'), '2027-01-01');
});

test('early review, invalid dates and date overflow fail safely', () => {
  error('INVALID_DATE', () => reviewCard(notebook(), 'study', 'one', 'again', '2026-11-07'));
  error('INVALID_DATE', () => dueCards(notebook(), 'study', '2026-02-29'));
  error('INVALID_DATE', () => upsertCard(notebook(), 'study', { id: 'two', front: 'Q', back: 'A' }, '1899-12-31'));
  error('INVALID_DATE', () => reviewCard(notebook([card('one', { due: '9999-12-31' })]), 'study', 'one', 'again', '9999-12-31'));
  error('INVALID_DATA', () => reviewCard(notebook(), 'study', 'one', 'maybe', TODAY));
});

test('invalid notebook shapes and extra keys are rejected', () => {
  for (const state of [null, [], { version: 1 }, { version: 2, decks: [] }, { version: 1, decks: [], extra: true }]) {
    error('INVALID_DATA', () => validateNotebook(state));
  }
  error('INVALID_DATA', () => validateNotebook(notebook([{ ...card(), extra: true }])));
  error('INVALID_DATA', () => upsertCard(notebook(), 'study', { id: 'two', front: 'Q', back: 'A', box: 2 }, TODAY));
});

test('duplicate card IDs are local to a deck, not global', () => {
  error('DUPLICATE_ID', () => validateNotebook(notebook([card(), card()])));
  const result = validateNotebook({ version: 1, decks: [notebook().decks[0], { ...notebook().decks[0], id: 'other' }] });
  assert.equal(result.decks.length, 2);
});

test('schedule invariants and exact integer bounds are enforced', () => {
  for (const changes of [{ box: 0 }, { box: 6 }, { box: 1.1 }, { reviews: -1 }, { reviews: NaN }, { reviews: Infinity }, { reviews: 0, box: 2 }, { reviews: 1, lastReviewed: null }, { reviews: 0, lastReviewed: TODAY }]) {
    error('INVALID_DATA', () => validateNotebook(notebook([card('one', changes)])));
  }
  error('INVALID_DATE', () => validateNotebook(notebook([card('one', { reviews: 1, lastReviewed: '2026-11-09' })])));
  error('LIMIT_EXCEEDED', () => reviewCard(notebook([card('one', { reviews: 1_000_000, lastReviewed: TODAY })]), 'study', 'one', 'again', TODAY));
});

test('text limits count Unicode points and reject isolated surrogates', () => {
  assert.equal(addDeck(createNotebook(), 'emoji', '😀'.repeat(80)).decks[0].title, '😀'.repeat(80));
  error('INVALID_DATA', () => addDeck(createNotebook(), 'emoji', '😀'.repeat(81)));
  for (const value of ['', '  ', '\u0000secret', '\u007f', '\ud800', '\udfff']) {
    error('INVALID_DATA', () => upsertCard(notebook(), 'study', { id: 'two', front: value, back: 'A' }, TODAY));
  }
  assert.equal(upsertCard(notebook(), 'study', { id: 'two', front: 'Linha\nseguinte\ttexto', back: 'A' }, TODAY).decks[0].cards[1].front, 'Linha\nseguinte\ttexto');
});

test('deck and total card limits are deliberate', () => {
  const decks = Array.from({ length: 100 }, (_, i) => ({ id: `d${i}`, title: `Deck ${i}`, cards: [] }));
  error('LIMIT_EXCEEDED', () => addDeck({ version: 1, decks }, 'more', 'Mais'));
  const base = notebook(Array.from({ length: 5_000 }, (_, i) => card(`c${i}`)));
  assert.equal(validateNotebook(base).decks[0].cards.length, 5_000);
  error('LIMIT_EXCEEDED', () => upsertCard(base, 'study', { id: 'more', front: 'Q', back: 'A' }, TODAY));
});

test('null-prototype records work but inherited required keys do not', () => {
  const plain = Object.assign(Object.create(null), createNotebook());
  assert.deepEqual(validateNotebook(plain), createNotebook());
  const inherited = Object.create({ version: 1 });
  inherited.decks = [];
  error('INVALID_DATA', () => validateNotebook(inherited));
});

test('JSON parsing catches duplicate keys, including escaped names', () => {
  for (const raw of ['{"version":1,"version":1,"decks":[]}', '{"version":1,"decks":[],"\\u0064ecks":[]}', '{"version":1,"decks":[{"id":"x","title":"X","title":"Y","cards":[]}]}']) {
    error('INVALID_DATA', () => parseNotebook(raw));
  }
  error('INVALID_DATA', () => parseNotebook('{"version":1,"decks":[],"__proto__":{}}'));
  assert.equal({}.polluted, undefined);
});

test('malformed JSON, control characters and unknown syntax are refused', () => {
  for (const raw of ['{} trailing', '{"version":1,"decks":[],}', '/* comment */{}', '{"version":NaN,"decks":[]}', '{"version":1e999,"decks":[]}', '{"version":1,"decks":[true]}', '\u0000{}']) {
    error('INVALID_DATA', () => parseNotebook(raw));
  }
  error('INVALID_DATA', () => parseNotebook(1));
});

test('backup parsing accepts BOM and serialization is canonical and stable', () => {
  const state = notebook();
  const expected = JSON.stringify(state, null, 2) + '\n';
  assert.equal(serializeNotebook(state), expected);
  assert.deepEqual(parseNotebook('\ufeff' + expected), state);
  assert.equal(serializeNotebook(parseNotebook(expected)), expected);
  assert.equal(expected.includes('exportedAt'), false);
});

test('large or overly nested backups fail with limit errors', () => {
  error('LIMIT_EXCEEDED', () => parseNotebook(' '.repeat(8 * 1024 * 1024 + 1)));
  error('LIMIT_EXCEEDED', () => parseNotebook('['.repeat(13) + '0' + ']'.repeat(13)));
});

test('the complete canonical backup budget applies to valid-looking states too', () => {
  const state = frozen(notebook(Array.from({ length: 2_100 }, (_, i) => card(`large${i}`, { front: 'a'.repeat(2_000), back: 'b'.repeat(2_000) }))));
  assert.ok(new TextEncoder().encode(JSON.stringify(state, null, 2) + '\n').byteLength > 8 * 1024 * 1024);
  error('LIMIT_EXCEEDED', () => validateNotebook(state));
  error('LIMIT_EXCEEDED', () => serializeNotebook(state));
  assert.equal(state.decks[0].cards.length, 2_100);
  assert.equal(state.decks[0].cards[0].front, 'a'.repeat(2_000));
});

test('canonical byte budgeting includes multibyte Unicode and JSON escaping', () => {
  const unicode = notebook(Array.from({ length: 1_100 }, (_, i) => card(`unicode${i}`, { front: '😀'.repeat(1_000), back: '😀'.repeat(1_000) })));
  assert.ok((JSON.stringify(unicode, null, 2) + '\n').length < 8 * 1024 * 1024);
  error('LIMIT_EXCEEDED', () => validateNotebook(unicode));
  const escaped = notebook(Array.from({ length: 1_100 }, (_, i) => card(`escaped${i}`, { front: '\\'.repeat(2_000), back: '\\'.repeat(2_000) })));
  error('LIMIT_EXCEEDED', () => validateNotebook(escaped));
});

test('every accepted backup remains round-trippable with five thousand short cards', () => {
  const state = frozen(notebook(Array.from({ length: 5_000 }, (_, i) => card(`small${i}`))));
  const encoded = serializeNotebook(state);
  assert.ok(new TextEncoder().encode(encoded).byteLength <= 8 * 1024 * 1024);
  assert.deepEqual(parseNotebook(encoded), state);
});

test('mutation that exceeds the shared backup budget preserves the entire input', () => {
  const candidates = Array.from({ length: 5_000 }, (_, i) => card(`s${i}`, { front: 'a'.repeat(1_300), back: 'b'.repeat(1_300) }));
  let low = 0;
  let high = candidates.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    const bytes = new TextEncoder().encode(JSON.stringify(notebook(candidates.slice(0, middle)), null, 2) + '\n').byteLength;
    if (bytes <= 8 * 1024 * 1024) low = middle;
    else high = middle;
  }
  const state = frozen(notebook(candidates.slice(0, low)));
  const before = serializeNotebook(state);
  error('LIMIT_EXCEEDED', () => upsertCard(state, 'study', { id: 'extra', front: 'a'.repeat(2_000), back: 'b'.repeat(2_000) }, TODAY));
  assert.equal(serializeNotebook(state), before);
});
