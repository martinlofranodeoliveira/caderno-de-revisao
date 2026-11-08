/** Pure notebook data and calendar rules. No clock, DOM, storage or network. */
const MAX_DECKS = 100;
const MAX_CARDS = 5_000;
const MAX_REVIEWS = 1_000_000;
const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
const MAX_DEPTH = 12;
const INTERVALS = [0, 1, 3, 7, 14, 30];
const ID = /^[a-zA-Z0-9_-]{1,64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactObject(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_DATA');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('INVALID_DATA');
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => !keys.includes(key))) fail('INVALID_DATA');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('INVALID_DATA');
  }
  return value;
}

function denseArray(value) {
  if (!Array.isArray(value)) fail('INVALID_DATA');
  const names = Reflect.ownKeys(value);
  if (names.length !== value.length + 1 || names.some((key) => key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(String(key)))) fail('INVALID_DATA');
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('INVALID_DATA');
  }
  return value;
}

function validId(value) {
  if (typeof value !== 'string' || !ID.test(value)) fail('INVALID_DATA');
  return value;
}

function text(value, maximum) {
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b-\u001f\u007f]/u.test(value) || /[\ud800-\udfff]/u.test(value)) fail('INVALID_DATA');
  const normalized = value.trim();
  let length = 0;
  for (const unused of normalized) {
    length += 1;
    if (length > maximum) fail('INVALID_DATA');
  }
  if (length === 0) fail('INVALID_DATA');
  return normalized;
}

function daysInMonth(year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function dateParts(value) {
  if (typeof value !== 'string') fail('INVALID_DATE');
  const match = DATE.exec(value);
  if (!match) fail('INVALID_DATE');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) fail('INVALID_DATE');
  return { year, month, day };
}

function addDays(value, amount) {
  let { year, month, day } = dateParts(value);
  day += amount;
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (year > 9999) fail('INVALID_DATE');
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizedCard(value) {
  exactObject(value, ['id', 'front', 'back', 'box', 'due', 'lastReviewed', 'reviews']);
  const id = validId(value.id);
  const front = text(value.front, 2_000);
  const back = text(value.back, 2_000);
  if (!Number.isInteger(value.box) || value.box < 1 || value.box > 5 || !Number.isInteger(value.reviews) || value.reviews < 0 || value.reviews > MAX_REVIEWS) fail('INVALID_DATA');
  dateParts(value.due);
  if (value.reviews === 0) {
    if (value.box !== 1 || value.lastReviewed !== null) fail('INVALID_DATA');
  } else {
    if (value.lastReviewed === null) fail('INVALID_DATA');
    dateParts(value.lastReviewed);
    if (value.lastReviewed > value.due) fail('INVALID_DATE');
  }
  return { id, front, back, box: value.box, due: value.due, lastReviewed: value.lastReviewed, reviews: value.reviews };
}

function canonicalNotebook(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertBackupBudget(value) {
  if (new TextEncoder().encode(canonicalNotebook(value)).byteLength > MAX_BACKUP_BYTES) fail('LIMIT_EXCEEDED');
}

/** Validate and deeply clone the exact version-one schema. */
export function validateNotebook(value) {
  exactObject(value, ['version', 'decks']);
  if (value.version !== 1) fail('INVALID_DATA');
  const decks = denseArray(value.decks);
  if (decks.length > MAX_DECKS) fail('LIMIT_EXCEEDED');
  const deckIds = new Set();
  let totalCards = 0;
  const normalized = [];
  for (const deck of decks) {
    exactObject(deck, ['id', 'title', 'cards']);
    const id = validId(deck.id);
    if (deckIds.has(id)) fail('DUPLICATE_ID');
    deckIds.add(id);
    const title = text(deck.title, 80);
    const cards = denseArray(deck.cards);
    totalCards += cards.length;
    if (totalCards > MAX_CARDS) fail('LIMIT_EXCEEDED');
    const cardIds = new Set();
    const normalizedCards = [];
    for (const candidate of cards) {
      const card = normalizedCard(candidate);
      if (cardIds.has(card.id)) fail('DUPLICATE_ID');
      cardIds.add(card.id);
      normalizedCards.push(card);
    }
    normalized.push({ id, title, cards: normalizedCards });
  }
  const result = { version: 1, decks: normalized };
  assertBackupBudget(result);
  return result;
}

export function createNotebook() {
  return { version: 1, decks: [] };
}

function findDeck(state, deckId) {
  validId(deckId);
  const result = state.decks.find((deck) => deck.id === deckId);
  if (!result) fail('NOT_FOUND');
  return result;
}

function findCard(deck, cardId) {
  validId(cardId);
  const result = deck.cards.find((card) => card.id === cardId);
  if (!result) fail('NOT_FOUND');
  return result;
}

export function addDeck(state, id, title) {
  const result = validateNotebook(state);
  validId(id);
  const normalizedTitle = text(title, 80);
  if (result.decks.some((deck) => deck.id === id)) fail('DUPLICATE_ID');
  result.decks.push({ id, title: normalizedTitle, cards: [] });
  return validateNotebook(result);
}

export function renameDeck(state, id, title) {
  const result = validateNotebook(state);
  const deck = findDeck(result, id);
  deck.title = text(title, 80);
  return validateNotebook(result);
}

export function removeDeck(state, id) {
  const result = validateNotebook(state);
  findDeck(result, id);
  result.decks = result.decks.filter((deck) => deck.id !== id);
  return validateNotebook(result);
}

export function upsertCard(state, deckId, card, today) {
  const result = validateNotebook(state);
  const deck = findDeck(result, deckId);
  exactObject(card, ['id', 'front', 'back']);
  const id = validId(card.id);
  const front = text(card.front, 2_000);
  const back = text(card.back, 2_000);
  dateParts(today);
  const existing = deck.cards.find((item) => item.id === id);
  if (existing) {
    existing.front = front;
    existing.back = back;
  } else {
    deck.cards.push({ id, front, back, box: 1, due: today, lastReviewed: null, reviews: 0 });
  }
  return validateNotebook(result);
}

export function removeCard(state, deckId, cardId) {
  const result = validateNotebook(state);
  const deck = findDeck(result, deckId);
  findCard(deck, cardId);
  deck.cards = deck.cards.filter((card) => card.id !== cardId);
  return validateNotebook(result);
}

export function dueCards(state, deckId, today) {
  const result = validateNotebook(state);
  const deck = findDeck(result, deckId);
  dateParts(today);
  return deck.cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.due <= today)
    .sort((left, right) => left.card.due < right.card.due ? -1 : left.card.due > right.card.due ? 1 : left.index - right.index)
    .map(({ card }) => card);
}

export function reviewCard(state, deckId, cardId, reviewResult, today) {
  const result = validateNotebook(state);
  const deck = findDeck(result, deckId);
  const card = findCard(deck, cardId);
  dateParts(today);
  if (reviewResult !== 'remember' && reviewResult !== 'again') fail('INVALID_DATA');
  if (today < card.due || (card.lastReviewed !== null && today < card.lastReviewed)) fail('INVALID_DATE');
  if (card.reviews >= MAX_REVIEWS) fail('LIMIT_EXCEEDED');
  const box = reviewResult === 'remember' ? Math.min(5, card.box + 1) : 1;
  const due = addDays(today, INTERVALS[box]);
  card.box = box;
  card.due = due;
  card.lastReviewed = today;
  card.reviews += 1;
  return validateNotebook(result);
}

export function serializeNotebook(state) {
  return canonicalNotebook(validateNotebook(state));
}

/** Strict JSON reader: duplicate decoded keys are rejected before schema validation. */
export function parseNotebook(textValue) {
  if (typeof textValue !== 'string') fail('INVALID_DATA');
  if (new TextEncoder().encode(textValue).byteLength > MAX_BACKUP_BYTES) fail('LIMIT_EXCEEDED');
  const source = textValue.startsWith('\ufeff') ? textValue.slice(1) : textValue;
  let cursor = 0;
  const whitespace = () => {
    while (cursor < source.length && /[ \t\r\n]/.test(source[cursor])) cursor += 1;
  };
  function string() {
    const start = cursor;
    if (source[cursor] !== '"') fail('INVALID_DATA');
    cursor += 1;
    let closed = false;
    while (cursor < source.length) {
      const character = source[cursor];
      cursor += 1;
      if (character === '\\') {
        if (cursor >= source.length) fail('INVALID_DATA');
        cursor += 1;
      } else if (character === '"') {
        closed = true;
        break;
      }
    }
    if (!closed) fail('INVALID_DATA');
    try {
      return JSON.parse(source.slice(start, cursor));
    } catch {
      fail('INVALID_DATA');
    }
  }
  function value(parentDepth) {
    whitespace();
    const character = source[cursor];
    if (character === '{' || character === '[') {
      const depth = parentDepth + 1;
      if (depth > MAX_DEPTH) fail('LIMIT_EXCEEDED');
      cursor += 1;
      whitespace();
      const object = character === '{';
      const result = object ? Object.create(null) : [];
      const end = object ? '}' : ']';
      if (source[cursor] === end) {
        cursor += 1;
        return result;
      }
      while (cursor < source.length) {
        whitespace();
        if (object) {
          const key = string();
          if (Object.hasOwn(result, key)) fail('INVALID_DATA');
          whitespace();
          if (source[cursor] !== ':') fail('INVALID_DATA');
          cursor += 1;
          result[key] = value(depth);
        } else {
          result.push(value(depth));
        }
        whitespace();
        if (source[cursor] === end) {
          cursor += 1;
          return result;
        }
        if (source[cursor] !== ',') fail('INVALID_DATA');
        cursor += 1;
      }
      fail('INVALID_DATA');
    }
    if (character === '"') return string();
    for (const [token, parsed] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(token, cursor)) {
        cursor += token.length;
        return parsed;
      }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(source.slice(cursor));
    if (number) {
      cursor += number[0].length;
      const parsed = Number(number[0]);
      if (!Number.isFinite(parsed)) fail('INVALID_DATA');
      return parsed;
    }
    fail('INVALID_DATA');
  }
  const parsed = value(0);
  whitespace();
  if (cursor !== source.length) fail('INVALID_DATA');
  return validateNotebook(parsed);
}
