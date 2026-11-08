import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html lang="pt-BR"><body></body></html>', { url: 'https://example.test/caderno/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'File', 'FileReader', 'Blob']) globalThis[name] = dom.window[name];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.URL = dom.window.URL;
const objects = new Map();
const downloads = [];
URL.createObjectURL = blob => { const url = `blob:example-${objects.size}`; objects.set(url, blob); return url; };
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ filename: this.download, blob: objects.get(this.href) }); };
dom.window.print = () => {};

const React = await import('react');
const { render, cleanup, fireEvent, screen, within, waitFor, act } = await import('@testing-library/react');
const { default: App } = await import('../.test-build/App.js');
const KEY = 'lofrano.caderno.v1';
const TODAY = '2026-11-08';

function card(id, front = 'Qual é a pergunta?', back = 'Esta é a resposta.', extra = {}) {
  return { id, front, back, box: 1, due: TODAY, lastReviewed: null, reviews: 0, ...extra };
}
function notebook(cards = [card('c1')]) { return { version: 1, decks: [{ id: 'd1', title: 'Biologia', cards }] }; }
function storage(value = null, options = {}) {
  const map = new Map([['outro-aplicativo', 'preservar']]);
  if (value !== null) map.set(KEY, typeof value === 'string' ? value : JSON.stringify(value));
  return { map, getItem(key) { if (options.failRead) throw new Error('denied'); return map.get(key) ?? null; }, setItem(key, value) { if (options.failWrite) throw new Error('quota'); map.set(key, value); }, removeItem(key) { if (options.failRemove) throw new Error('denied'); map.delete(key); } };
}
function mount(store = storage()) { render(React.createElement(App, { storage: store, today: TODAY })); return store; }
function dialog() { return within(screen.getByRole('dialog')); }
function makeDeck(title = 'Química') {
  fireEvent.click(screen.getByRole('button', { name: 'Novo baralho', exact: true }));
  const input = dialog().getByLabelText(/Nome do baralho/);
  fireEvent.change(input, { target: { value: title } });
  fireEvent.submit(input.closest('form'));
}
function makeCard(front = 'O que é um átomo?', back = 'Uma unidade da matéria.') {
  fireEvent.click(screen.getByRole('button', { name: 'Novo cartão', exact: true }));
  const input = dialog().getByLabelText(/^Pergunta/);
  fireEvent.change(input, { target: { value: front } });
  fireEvent.change(dialog().getByLabelText(/^Resposta/), { target: { value: back } });
  fireEvent.submit(input.closest('form'));
}
function startReview() { fireEvent.click(screen.getByRole('button', { name: /^Revisar/ })); }
function reveal() { fireEvent.click(screen.getByRole('button', { name: /^Revelar resposta/ })); }
async function upload(text) {
  const file = new File([text], 'backup.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Selecionar backup JSON'), { target: { files: [file] } });
}
function blobText(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob); }); }

beforeEach(() => { objects.clear(); downloads.length = 0; });
afterEach(async () => { cleanup(); await act(async () => {}); });

test('primeira abertura é vazia, exemplos são opt-in e o arquivo de outro aplicativo é preservado', () => {
  const store = mount();
  assert.ok(screen.getByRole('heading', { name: /Um cartão de cada vez/ }));
  assert.equal(store.map.has(KEY), false);
  assert.equal(screen.queryByText(/Qual é a diferença entre/), null);
  fireEvent.click(screen.getByRole('button', { name: 'Experimentar com exemplos' }));
  const saved = JSON.parse(store.map.get(KEY));
  assert.equal(saved.decks.length, 1);
  assert.equal(saved.decks[0].cards.length, 3);
  assert.ok(saved.decks[0].cards.every(item => item.due === TODAY));
  assert.equal(store.map.get('outro-aplicativo'), 'preservar');
});

test('cria baralho e cartão e salva uma estrutura validada no armazenamento', () => {
  const store = mount();
  makeDeck(); makeCard();
  const saved = JSON.parse(store.map.get(KEY));
  assert.equal(saved.decks[0].title, 'Química');
  assert.equal(saved.decks[0].cards[0].front, 'O que é um átomo?');
  assert.equal(saved.decks[0].cards[0].due, TODAY);
  assert.ok(screen.getByText('Alterações salvas neste navegador.', { exact: false }));
});

test('editar o cartão e renomear o baralho preserva a agenda existente', () => {
  const original = card('c1', 'Pergunta antiga', 'Resposta antiga', { box: 4, due: '2026-11-22', lastReviewed: TODAY, reviews: 7 });
  const store = mount(storage(notebook([original])));
  fireEvent.click(screen.getByRole('button', { name: 'Editar cartão: Pergunta antiga' }));
  const input = dialog().getByLabelText(/^Pergunta/);
  fireEvent.change(input, { target: { value: 'Pergunta revisada' } });
  fireEvent.submit(input.closest('form'));
  fireEvent.click(screen.getByRole('button', { name: 'Renomear' }));
  const title = dialog().getByLabelText(/Nome do baralho/);
  fireEvent.change(title, { target: { value: 'Ciências' } });
  fireEvent.submit(title.closest('form'));
  const saved = JSON.parse(store.map.get(KEY)).decks[0];
  assert.equal(saved.title, 'Ciências');
  assert.deepEqual(saved.cards[0], { ...original, front: 'Pergunta revisada' });
});

test('sessão esconde a resposta até revelar, Lembrei avança e conclui a sessão', () => {
  const store = mount(storage(notebook()));
  startReview();
  assert.equal(screen.queryByText('Esta é a resposta.'), null);
  assert.equal(screen.queryByRole('button', { name: /^Lembrei/ }), null);
  reveal();
  assert.ok(screen.getByText('Esta é a resposta.'));
  fireEvent.click(screen.getByRole('button', { name: /^Lembrei/ }));
  assert.ok(screen.getByRole('heading', { name: 'Revisão concluída.' }));
  const saved = JSON.parse(store.map.get(KEY)).decks[0].cards[0];
  assert.equal(saved.box, 2); assert.equal(saved.due, '2026-11-11'); assert.equal(saved.reviews, 1);
});

test('Repetir pelo atalho só funciona após revelar e retorna para caixa1 no dia seguinte', () => {
  const store = mount(storage(notebook([card('c1', 'Pergunta', 'Resposta', { box: 5, due: TODAY, lastReviewed: '2026-10-09', reviews: 10 })])));
  startReview();
  fireEvent.keyDown(window, { key: '1' });
  assert.equal(store.map.get(KEY).includes('"reviews": 11'), false);
  fireEvent.keyDown(window, { key: ' ' });
  fireEvent.keyDown(window, { key: '1' });
  const saved = JSON.parse(store.map.get(KEY)).decks[0].cards[0];
  assert.equal(saved.box, 1); assert.equal(saved.due, '2026-11-09'); assert.equal(saved.reviews, 11);
});

test('atalhos não capturam espaço digitado em campo e não avaliam antes da revelação', () => {
  const store = mount(storage(notebook())); startReview();
  const input = document.createElement('input'); document.body.append(input);
  fireEvent.keyDown(input, { key: ' ' });
  assert.equal(screen.queryByText('Esta é a resposta.'), null);
  fireEvent.keyDown(window, { key: '2' });
  assert.equal(JSON.parse(store.map.get(KEY)).decks[0].cards[0].reviews, 0);
  input.remove();
});

test('estudo inclui apenas cartões vencidos, sem revelar os futuros', () => {
  mount(storage(notebook([card('c1', 'Hoje', 'Resposta hoje'), card('c2', 'No futuro', 'Resposta futura', { due: '2026-12-01' })])));
  startReview();
  assert.ok(screen.getByRole('heading', { name: 'Hoje' }));
  assert.equal(screen.queryByText('No futuro'), null);
  assert.ok(screen.getByText('Cartão 1 de 1'));
});

test('backup validado mostra prévia e cancelar mantém os dados existentes byte a byte', async () => {
  const store = mount(storage(notebook())); const before = store.map.get(KEY);
  const incoming = { version: 1, decks: [{ id: 'new', title: 'História', cards: [] }] };
  await upload(JSON.stringify(incoming));
  await screen.findByRole('dialog');
  assert.ok(dialog().getByRole('heading', { name: 'Substituir o caderno?' }));
  assert.equal(store.map.get(KEY), before);
  fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }));
  assert.equal(store.map.get(KEY), before);
  assert.ok(screen.getByRole('heading', { name: 'Biologia', exact: true }));
});

test('confirmar importação substitui por inteiro e salva somente após a confirmação', async () => {
  const store = mount(storage(notebook()));
  const incoming = { version: 1, decks: [{ id: 'new', title: 'História', cards: [card('new-card', 'Ano?', 'Resposta nova')] }] };
  await upload(JSON.stringify(incoming)); await screen.findByRole('dialog');
  fireEvent.click(dialog().getByRole('button', { name: 'Substituir dados' }));
  assert.deepEqual(JSON.parse(store.map.get(KEY)), incoming);
  assert.ok(screen.getByRole('heading', { name: 'História', exact: true }));
  assert.equal(screen.queryByText('Qual é a pergunta?'), null);
});

test('backup inválido é recusado antes de qualquer substituição', async () => {
  const store = mount(storage(notebook())); const before = store.map.get(KEY);
  await upload('{"version":1,"version":1,"decks":[]}');
  await screen.findByRole('alert');
  assert.match(screen.getByRole('alert').textContent, /Backup não importado/);
  assert.equal(store.map.get(KEY), before);
  assert.equal(screen.queryByRole('dialog'), null);
});

test('quota impede salvar mas mantém o caderno na memória, com aviso persistente e exportação', async () => {
  const store = mount(storage(null, { failWrite: true }));
  makeDeck('Memória'); makeCard('Ainda está aqui?', 'Sim.');
  assert.ok(screen.getByText('Ainda está aqui?'));
  assert.match(screen.getByRole('alert').textContent, /alterações continuam na memória/);
  assert.equal(store.map.has(KEY), false);
  assert.equal(screen.queryByText(/Alterações salvas neste navegador/), null);
  fireEvent.click(screen.getByRole('button', { name: 'Exportar backup', exact: true }));
  assert.equal(downloads[0].filename, 'caderno-de-revisao.json');
  const exported = JSON.parse(await blobText(downloads[0].blob));
  assert.equal(exported.decks[0].cards[0].front, 'Ainda está aqui?');
});

test('dados locais inválidos são preservados, recuperáveis e removidos só após confirmação', async () => {
  const raw = '{backup antigo inválido'; const store = mount(storage(raw));
  assert.equal(screen.getByRole('button', { name: 'Novo baralho', exact: true }).disabled, true);
  assert.equal(store.map.get(KEY), raw);
  fireEvent.click(screen.getByRole('button', { name: 'Baixar recuperação original' }));
  assert.equal(await blobText(downloads[0].blob), raw);
  fireEvent.click(screen.getByRole('button', { name: 'Remover dados inválidos' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }));
  assert.equal(store.map.get(KEY), raw);
  fireEvent.click(screen.getByRole('button', { name: 'Remover dados inválidos' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Remover somente estes dados' }));
  assert.equal(store.map.has(KEY), false);
  assert.equal(store.map.get('outro-aplicativo'), 'preservar');
  assert.equal(screen.getByRole('button', { name: 'Novo baralho', exact: true }).disabled, false);
});

test('Escape cancela diálogo e devolve foco ao controle que o abriu', async () => {
  mount(); const trigger = screen.getByRole('button', { name: 'Novo baralho', exact: true });
  trigger.focus(); fireEvent.click(trigger);
  const panel = screen.getByRole('dialog');
  assert.equal(panel.contains(document.activeElement), true);
  fireEvent.keyDown(panel, { key: 'Escape' });
  await act(async () => {});
  assert.equal(screen.queryByRole('dialog'), null);
  assert.equal(document.activeElement, trigger);
});

test('exclusão requer confirmação e cancelar conserva cartão e agenda', () => {
  const store = mount(storage(notebook())); const before = store.map.get(KEY);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir cartão: Qual é a pergunta?' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }));
  assert.equal(store.map.get(KEY), before);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir cartão: Qual é a pergunta?' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Excluir definitivamente' }));
  assert.equal(JSON.parse(store.map.get(KEY)).decks[0].cards.length, 0);
});

test('busca local encontra texto com ou sem acento e não altera os cartões', () => {
  const store = mount(storage(notebook([card('c1', 'O que é uma célula?', 'Unidade da vida.'), card('c2', 'O que é luz?', 'Radiação.')] )));
  const before = store.map.get(KEY);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar cartões' }), { target: { value: 'celula' } });
  assert.ok(screen.getByText('O que é uma célula?'));
  assert.equal(screen.queryByText('O que é luz?'), null);
  assert.equal(store.map.get(KEY), before);
});

test('texto com HTML permanece literal, sem criação de elementos ativos', () => {
  const front = '<img src=x onerror="alert(1)">';
  mount(storage(notebook([card('c1', front, '<script>run()</script>')])));
  assert.ok(screen.getByRole('heading', { name: front }));
  assert.equal(document.querySelector('img'), null); assert.equal(document.querySelector('script'), null);
  startReview(); reveal();
  assert.ok(screen.getByText('<script>run()</script>'));
  assert.equal(document.querySelector('script'), null);
});

test('área de impressão contém somente o baralho selecionado e some após imprimir', () => {
  const state = notebook([card('c1', 'Pergunta selecionada', 'Resposta selecionada')]);
  state.decks.push({ id: 'd2', title: 'Outro baralho', cards: [card('c2', 'Não imprimir', 'Privado do outro baralho')] });
  mount(storage(state));
  fireEvent.click(screen.getByRole('button', { name: 'Imprimir', exact: true }));
  const sheet = document.querySelector('.print-sheet');
  assert.ok(sheet); assert.match(sheet.textContent, /Pergunta selecionada/); assert.equal(sheet.textContent.includes('Não imprimir'), false);
  fireEvent(window, new Event('afterprint'));
  assert.equal(document.querySelector('.print-sheet'), null);
});

test('falha de acesso inicial ao armazenamento permite trabalhar em memória com aviso', () => {
  mount(storage(null, { failRead: true }));
  assert.match(screen.getByRole('alert').textContent, /armazenamento não está disponível/);
  makeDeck('Sessão temporária');
  assert.ok(screen.getByRole('heading', { name: 'Sessão temporária' }));
  assert.match(screen.getByRole('alert').textContent, /alterações continuam na memória/);
});

test('guarda de gravação preserva versão da aba A e trabalho da aba B em memória, mesmo antes de storage event', async () => {
  const store = mount(storage(notebook()));
  const savedByA = JSON.stringify(notebook([card('c1', 'Mudança da aba A', 'Conteúdo A')]));
  store.setItem(KEY, savedByA);
  makeCard('Pergunta da aba B', 'Conteúdo B');
  assert.equal(store.map.get(KEY), savedByA);
  assert.ok(screen.getByText('Pergunta da aba B'));
  assert.match(screen.getByRole('alert').textContent, /dados salvos mudaram em outra aba/);
  fireEvent.click(screen.getByRole('button', { name: 'Exportar meu trabalho' }));
  const exported = JSON.parse(await blobText(downloads[0].blob));
  assert.equal(exported.decks[0].cards[1].front, 'Pergunta da aba B');
  assert.equal(store.map.get(KEY), savedByA);
  fireEvent.click(screen.getByRole('button', { name: 'Carregar versão salva' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }));
  assert.ok(screen.getByText('Pergunta da aba B'));
  fireEvent.click(screen.getByRole('button', { name: 'Carregar versão salva' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Descartar meu trabalho e carregar' }));
  assert.ok(screen.getByText('Mudança da aba A'));
  assert.equal(screen.queryByText('Pergunta da aba B'), null);
  assert.equal(store.map.get(KEY), savedByA);
  makeCard('Nova edição após carregar', 'Versão atual');
  const saved = JSON.parse(store.map.get(KEY));
  assert.equal(saved.decks[0].cards[0].front, 'Mudança da aba A');
  assert.equal(saved.decks[0].cards[1].front, 'Nova edição após carregar');
});

test('storage event anuncia conflito sem substituir automaticamente o caderno desta aba', () => {
  const store = mount(storage(notebook()));
  const savedByA = JSON.stringify(notebook([card('c1', 'Atualização externa', 'Resposta externa')]));
  store.setItem(KEY, savedByA);
  fireEvent(window, new window.StorageEvent('storage', { key: KEY, newValue: savedByA }));
  assert.match(screen.getByRole('alert').textContent, /dados salvos mudaram em outra aba/);
  assert.ok(screen.getByText('Qual é a pergunta?'));
  assert.equal(screen.queryByText('Atualização externa'), null);
  assert.equal(store.map.get(KEY), savedByA);
});

test('recarregar versão inacessível ou inválida mantém o trabalho em memória', () => {
  const store = mount(storage(notebook()));
  store.setItem(KEY, '{arquivo externo inválido');
  fireEvent(window, new window.StorageEvent('storage', { key: KEY }));
  fireEvent.click(screen.getByRole('button', { name: 'Carregar versão salva' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Descartar meu trabalho e carregar' }));
  assert.match(dialog().getByRole('alert').textContent, /trabalho nesta aba foi preservado/);
  fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }));
  assert.ok(screen.getByText('Qual é a pergunta?'));
  assert.equal(store.map.get(KEY), '{arquivo externo inválido');
  store.getItem = () => { throw new Error('denied'); };
  fireEvent.click(screen.getByRole('button', { name: 'Carregar versão salva' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Descartar meu trabalho e carregar' }));
  assert.match(dialog().getByRole('alert').textContent, /trabalho nesta aba foi preservado/);
  fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }));
  assert.ok(screen.getByText('Qual é a pergunta?'));
});

test('remover recuperação inválida não apaga uma versão que mudou em outra aba', () => {
  const store = mount(storage('{inválido original'));
  const savedByA = JSON.stringify(notebook());
  store.setItem(KEY, savedByA);
  fireEvent.click(screen.getByRole('button', { name: 'Remover dados inválidos' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Remover somente estes dados' }));
  assert.match(dialog().getByRole('alert').textContent, /dados salvos mudaram/);
  assert.equal(store.map.get(KEY), savedByA);
  assert.equal(store.map.get('outro-aplicativo'), 'preservar');
});

test('contagens e caixas atualizam após criar, excluir, revisar e importar', async () => {
  mount(); makeDeck('Contagens'); makeCard('Pergunta um', 'Resposta um');
  const boxes = () => [...screen.getByRole('list', { name: 'Caixas de revisão' }).querySelectorAll('strong')].map(item => item.textContent.trim());
  assert.equal(boxes()[0], '1 cartão');
  makeCard('Pergunta dois', 'Resposta dois');
  assert.equal(boxes()[0], '2 cartões');
  fireEvent.click(screen.getByRole('button', { name: 'Excluir cartão: Pergunta dois' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Excluir definitivamente' }));
  assert.equal(boxes()[0], '1 cartão');
  startReview(); reveal(); fireEvent.click(screen.getByRole('button', { name: /^Lembrei/ }));
  assert.equal(boxes()[0], '0 cartões'); assert.equal(boxes()[1], '1 cartão');
  assert.equal(screen.getByRole('button', { name: /^Revisar/ }).textContent, 'Revisar 0');
  await upload(JSON.stringify(notebook([card('c1'), card('c2', 'Outra pergunta', 'Resposta')] )));
  await screen.findByRole('dialog');
  fireEvent.click(dialog().getByRole('button', { name: 'Substituir dados' }));
  assert.equal(boxes()[0], '2 cartões');
  assert.equal(screen.getByRole('button', { name: /^Revisar/ }).textContent, 'Revisar 2');
});

test('Web Locks permite uma única aba editora e a segunda assume a edição após liberação', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'locks');
  let held = false;
  const manager = { async request(name, options, callback) {
    assert.equal(name, 'lofrano.caderno.v1.editor');
    assert.equal(options.mode, 'exclusive'); assert.equal(options.ifAvailable, true);
    if (held) return callback(null);
    held = true;
    try { return await callback({ name, mode: 'exclusive' }); }
    finally { held = false; }
  } };
  Object.defineProperty(navigator, 'locks', { configurable: true, value: manager });
  try {
    const shared = storage();
    const first = render(React.createElement(App, { storage: shared, today: TODAY }));
    const firstScope = within(first.container);
    await waitFor(() => assert.equal(firstScope.getByRole('button', { name: 'Novo baralho', exact: true }).disabled, false));
    const second = render(React.createElement(App, { storage: shared, today: TODAY }));
    const secondScope = within(second.container);
    await secondScope.findByText(/Outra aba está editando este caderno/);
    assert.equal(secondScope.getByRole('button', { name: 'Novo baralho', exact: true }).disabled, true);
    assert.equal(secondScope.getByRole('button', { name: 'Importar backup' }).disabled, true);
    assert.equal(secondScope.getByRole('button', { name: 'Exportar backup', exact: true }).disabled, false);
    fireEvent.click(secondScope.getByRole('button', { name: 'Novo baralho', exact: true }));
    assert.equal(secondScope.queryByRole('dialog'), null);
    assert.equal(shared.map.has(KEY), false);
    first.unmount();
    await act(async () => {});
    fireEvent.click(secondScope.getByRole('button', { name: 'Tentar assumir edição' }));
    await waitFor(() => assert.equal(secondScope.getByRole('button', { name: 'Novo baralho', exact: true }).disabled, false));
    makeDeck('Agora nesta aba');
    assert.equal(JSON.parse(shared.map.get(KEY)).decks[0].title, 'Agora nesta aba');
  } finally {
    cleanup(); await act(async () => {});
    if (previous) Object.defineProperty(navigator, 'locks', previous); else delete navigator.locks;
  }
});

test('Web Locks indisponível por erro cai para guarda otimista sem bloquear trabalho em memória', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { async request() { throw new Error('unavailable'); } } });
  try {
    const store = mount();
    await waitFor(() => assert.equal(screen.getByRole('button', { name: 'Novo baralho', exact: true }).disabled, false));
    makeDeck('Uma aba por vez');
    assert.equal(JSON.parse(store.map.get(KEY)).decks[0].title, 'Uma aba por vez');
    assert.match(screen.getByText(/Para evitar conflitos, edite em uma aba por vez/).textContent, /uma aba por vez/);
  } finally {
    cleanup(); await act(async () => {});
    if (previous) Object.defineProperty(navigator, 'locks', previous); else delete navigator.locks;
  }
});
