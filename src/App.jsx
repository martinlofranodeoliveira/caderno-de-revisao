import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { addDeck, createNotebook, dueCards, parseNotebook, removeCard, removeDeck, renameDeck, reviewCard, serializeNotebook, upsertCard } from './engine.js';
import { STORAGE_KEY, clearStorage, compareStorage, loadStorage, saveStorage } from './storage.js';
import { summarizeNotebook } from './summary.js';

const INTERVALS = [1, 3, 7, 14, 30];
const UNSAVED = 'Não foi possível salvar neste navegador. Suas alterações continuam na memória. Exporte um backup antes de sair.';
const CONFLICT = 'Os dados salvos mudaram em outra aba. Seu trabalho nesta aba continua na memória e não vai substituir a versão salva. Exporte seu trabalho antes de carregar a versão atual.';
const EDITOR_LOCK = 'lofrano.caderno.v1.editor';
let fallbackCounter = 0;

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function newId(prefix) {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${random || `${Date.now().toString(36)}-${++fallbackCounter}`}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function textError(error) {
  return ({ INVALID_DATE: 'A data ou a agenda do cartão não é válida. Confira o arquivo e a data do dispositivo.', LIMIT_EXCEEDED: 'O caderno atingiu o limite. Exporte uma cópia ou reduza o conteúdo. São permitidos até 100 baralhos, 5.000 cartões e 8 MiB no total.', DUPLICATE_ID: 'O arquivo contém identificadores repetidos. Corrija o backup antes de importar.', NOT_FOUND: 'Este baralho ou cartão não está mais disponível.' })[error?.code] || 'Não foi possível concluir. Confira os campos e o formato dos dados.';
}

function Icon({ name, ...props }) {
  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    book: <><path d="M3 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3zM13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" /></>,
    arrow: <><path d="M4 12h15m-5-5 5 5-5 5" /></>,
    close: <><path d="m6 6 12 12M6 18 18 6" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    print: <><path d="M7 8V3h10v5M7 16H3V9h18v7h-4M7 13h10v8H7z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readFile(file) {
  if (file.size > 8 * 1024 * 1024) throw Object.assign(new Error('LIMIT_EXCEEDED'), { code: 'LIMIT_EXCEEDED' });
  const bytes = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsArrayBuffer(file);
  });
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function Modal({ title, children, onClose, returnFocus }) {
  const panel = useRef(null);
  const heading = useRef(newId('dialog')).current;
  useEffect(() => {
    const first = panel.current?.querySelector('input,textarea,button,select,[tabindex="0"]');
    (first || panel.current)?.focus();
    return () => { queueMicrotask(() => { if (returnFocus?.isConnected) returnFocus.focus(); }); };
  }, [returnFocus]);
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')];
    if (!controls.length) { event.preventDefault(); panel.current.focus(); return; }
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby={heading} tabIndex="-1" ref={panel} onKeyDown={keyDown}>
    <div className="modal-heading"><h2 id={heading}>{title}</h2><button className="icon-button" type="button" aria-label="Fechar diálogo" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </section></div>;
}

export default function App({ storage: providedStorage, today = localDate() }) {
  const [initial] = useState(() => loadStorage(providedStorage));
  const [notebook, setNotebook] = useState(initial.notebook);
  const [selectedId, setSelectedId] = useState(initial.notebook.decks[0]?.id || null);
  const [warning, setWarning] = useState(initial.warning);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [rawRecovery, setRawRecovery] = useState(initial.raw);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [draft, setDraft] = useState({ title: '', front: '', back: '' });
  const [study, setStudy] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [lease, setLease] = useState(() => typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function' ? 'checking' : 'optimistic');
  const storageRef = useRef(initial.storage);
  const expectedRaw = useRef(initial.expectedRaw);
  const retryLease = useRef(null);
  const fileInput = useRef(null);
  const importSequence = useRef(0);
  const deck = notebook.decks.find(item => item.id === selectedId) || null;
  const summary = useMemo(() => summarizeNotebook(notebook, today), [notebook, today]);
  const counts = summary.dueCounts;
  const due = deck ? counts[deck.id] : 0;
  const totalCards = summary.totalCards;
  const leaseBlocked = lease === 'checking' || lease === 'readonly';
  const editingBlocked = blocked || leaseBlocked;
  const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const cards = deck?.cards.filter(card => `${card.front}\n${card.back}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(normalizedSearch)) || [];
  const studyingDeck = study ? notebook.decks.find(item => item.id === study.deckId) : null;
  const current = studyingDeck?.cards.find(item => item.id === study.ids[study.index]) || null;

  function openDialog(value) {
    setDialogError('');
    setDialog({ ...value, returnFocus: document.activeElement });
  }
  function closeDialog() { setDialog(null); setDialogError(''); }
  function markConflict() {
    setConflict(true); setSaved(false); setWarning(CONFLICT);
  }
  function commit(next, message = 'Caderno atualizado.') {
    if (leaseBlocked) {
      setError('Esta aba está somente para leitura. Exporte o trabalho ou tente assumir a edição quando a outra aba for fechada.');
      return false;
    }
    setNotebook(next);
    setError('');
    setNotice(message);
    const result = conflict ? { status: 'conflict' } : saveStorage(storageRef.current, next, expectedRaw.current);
    const persisted = result.status === 'saved';
    setSaved(persisted);
    if (result.status === 'conflict') markConflict();
    else setWarning(persisted ? '' : UNSAVED);
    if (persisted) { expectedRaw.current = result.raw; setRawRecovery(null); }
    return true;
  }
  function change(operation, message) {
    try { return commit(operation(notebook), message); }
    catch (failure) { setDialogError(textError(failure)); setError(textError(failure)); return false; }
  }
  function selectDeck(id) { setSelectedId(id); setStudy(null); setSearch(''); setError(''); }
  function startStudy() {
    if (!deck || editingBlocked) return;
    setStudy({ deckId: deck.id, ids: dueCards(notebook, deck.id, today).map(card => card.id), index: 0, revealed: false });
    setError('');
  }
  function answer(result) {
    if (!study || !current || !study.revealed) return;
    if (change(state => reviewCard(state, study.deckId, current.id, result, today), result === 'remember' ? 'Cartão avançou de caixa.' : 'Cartão volta amanhã.')) {
      setStudy(value => ({ ...value, index: value.index + 1, revealed: false }));
    }
  }
  function exportBackup(raw = false) {
    try {
      downloadText(raw ? rawRecovery : serializeNotebook(notebook), raw ? 'caderno-recuperacao.json' : 'caderno-de-revisao.json');
      setNotice(raw ? 'Download do arquivo de recuperação solicitado.' : 'Download do backup solicitado. Guarde uma cópia fora do navegador.');
    } catch { setError('O navegador não conseguiu iniciar o download. Tente novamente em um navegador compatível.'); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const sequence = ++importSequence.current;
    setError('');
    try {
      const candidate = parseNotebook(await readFile(file));
      if (sequence !== importSequence.current) return;
      openDialog({ type: 'import', candidate });
    } catch (failure) {
      if (sequence === importSequence.current) setError(`Backup não importado. ${textError(failure)}`);
    }
  }
  function loadExamples() {
    if (editingBlocked || notebook.decks.length) return;
    let next = addDeck(createNotebook(), newId('deck'), 'Português · exemplo');
    const id = next.decks[0].id;
    for (const [front, back] of [['Qual é a diferença entre “mas” e “mais”?', '“Mas” expressa oposição. “Mais” indica quantidade ou intensidade.'], ['Quando usar “por que” em uma pergunta?', 'Use “por que” no início de perguntas diretas ou indiretas sobre uma razão.'], ['O que é uma palavra proparoxítona?', 'É uma palavra cuja sílaba tônica é a antepenúltima, como “música”.']]) next = upsertCard(next, id, { id: newId('card'), front, back }, today);
    commit(next, 'Exemplos demonstrativos carregados. Você pode editá-los ou excluí-los.');
    setSelectedId(id);
  }
  function submitEditor(event) {
    event.preventDefault();
    const editing = dialog;
    if (editing.type === 'deck') {
      const id = editing.id || newId('deck');
      const ok = change(state => editing.id ? renameDeck(state, id, draft.title) : addDeck(state, id, draft.title), editing.id ? 'Nome do baralho atualizado.' : 'Baralho criado. Agora adicione seu primeiro cartão.');
      if (ok) { setSelectedId(id); setStudy(null); closeDialog(); }
    } else if (editing.type === 'card') {
      const id = editing.id || newId('card');
      if (change(state => upsertCard(state, editing.deckId, { id, front: draft.front, back: draft.back }, today), editing.id ? 'Cartão atualizado. A agenda foi preservada.' : 'Cartão criado e disponível para revisar hoje.')) closeDialog();
    }
  }
  function confirmAction() {
    if (dialog.type === 'delete-deck') {
      const remaining = notebook.decks.filter(item => item.id !== dialog.id);
      if (change(state => removeDeck(state, dialog.id), 'Baralho excluído.')) { setSelectedId(remaining[0]?.id || null); setStudy(null); closeDialog(); }
    } else if (dialog.type === 'delete-card') {
      if (change(state => removeCard(state, dialog.deckId, dialog.id), 'Cartão excluído.')) closeDialog();
    } else if (dialog.type === 'import') {
      if (commit(dialog.candidate, 'Backup validado e carregado.')) {
        setBlocked(false); setSelectedId(dialog.candidate.decks[0]?.id || null); setStudy(null); setSearch(''); closeDialog();
      }
    } else if (dialog.type === 'reload') {
      const fresh = loadStorage(providedStorage);
      if (!fresh.storage || fresh.blocked) {
        if (fresh.raw !== null) setRawRecovery(fresh.raw);
        setDialogError('Não foi possível abrir a versão salva. Seu trabalho nesta aba foi preservado. Cancele e exporte uma cópia antes de tentar recuperar os dados.');
        return;
      }
      storageRef.current = fresh.storage; expectedRaw.current = fresh.expectedRaw;
      setNotebook(fresh.notebook); setSelectedId(fresh.notebook.decks[0]?.id || null);
      setRawRecovery(fresh.raw); setBlocked(fresh.blocked); setWarning(fresh.warning);
      setSaved(false); setConflict(false); setStudy(null); setSearch(''); setError('');
      setNotice('A versão salva foi carregada nesta aba.'); closeDialog();
    } else if (dialog.type === 'reset') {
      if (leaseBlocked) { setDialogError('Esta aba está somente para leitura.'); return; }
      const result = clearStorage(storageRef.current, expectedRaw.current);
      if (result.status === 'saved') {
        expectedRaw.current = null;
        setNotebook(createNotebook()); setSelectedId(null); setRawRecovery(null); setBlocked(false); setSaved(false); setWarning(''); setNotice('Somente os dados deste aplicativo foram removidos.'); closeDialog();
      } else if (result.status === 'conflict') {
        markConflict(); setDialogError('Os dados salvos mudaram. Cancele e carregue a versão atual antes de remover qualquer dado.');
      } else setDialogError('Não foi possível remover a chave deste aplicativo. Os dados existentes foram preservados.');
    }
  }
  function printDeck() {
    if (!deck?.cards.length) return;
    flushSync(() => setPrinting(true));
    try { window.print(); } catch { setPrinting(false); setError('A impressão não está disponível neste navegador. Exporte um backup para preservar o conteúdo.'); }
  }

  useEffect(() => {
    function changed(event) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const result = compareStorage(storageRef.current, expectedRaw.current);
      if (result.status === 'conflict') markConflict();
      else if (result.status === 'unavailable') { setSaved(false); setWarning(UNSAVED); }
    }
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  useEffect(() => {
    if (typeof navigator.locks?.request !== 'function') return;
    let alive = true;
    let release = null;
    let requesting = false;
    async function acquire() {
      if (!alive || requesting || release) return;
      requesting = true; setLease('checking');
      try {
        await navigator.locks.request(EDITOR_LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
          if (!alive) return;
          if (!lock) { setLease('readonly'); return; }
          setLease('owned');
          await new Promise(resolve => { release = resolve; });
          release = null;
        });
      } catch { if (alive) setLease('optimistic'); }
      finally { requesting = false; }
    }
    retryLease.current = acquire;
    // Avoid acquiring from a discarded StrictMode effect during development.
    queueMicrotask(() => { if (alive) acquire(); });
    return () => { alive = false; retryLease.current = null; release?.(); };
  }, []);
  useEffect(() => {
    function beforePrint() { flushSync(() => setPrinting(true)); }
    function afterPrint() { setPrinting(false); }
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => { window.removeEventListener('beforeprint', beforePrint); window.removeEventListener('afterprint', afterPrint); };
  }, []);
  useEffect(() => {
    function onKey(event) {
      if (dialog || editingBlocked || !study || !current || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === ' ' && !study.revealed && !event.target?.closest?.('button,a')) { event.preventDefault(); setStudy(value => ({ ...value, revealed: true })); }
      if (study.revealed && (event.key === '1' || event.key === '2')) { event.preventDefault(); answer(event.key === '1' ? 'again' : 'remember'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, study, current, notebook, today, editingBlocked]);

  const dialogTitle = dialog ? ({ deck: dialog.id ? 'Renomear baralho' : 'Novo baralho', card: dialog.id ? 'Editar cartão' : 'Novo cartão', 'delete-deck': 'Excluir este baralho?', 'delete-card': 'Excluir este cartão?', import: 'Substituir o caderno?', reset: 'Remover dados locais inválidos?', reload: 'Carregar a versão salva?' })[dialog.type] : '';
  const importedCount = dialog?.type === 'import' ? dialog.candidate.decks.reduce((sum, item) => sum + item.cards.length, 0) : 0;

  return <>
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
      <header className="app-header"><a className="wordmark" href="#" onClick={event => { event.preventDefault(); setStudy(null); }}><span className="brand-mark"><Icon name="book" /></span>Caderno de Revisão</a><span className="header-note">Seu estudo, no seu ritmo.</span><a className="lofrano-link" href="https://lofranotecnologia.com.br" target="_blank" rel="noreferrer">LOFRANO TECNOLOGIA</a></header>
      <div className="workspace">
        <aside className="library-index" aria-label="Biblioteca de baralhos">
          <div className="index-heading"><h2>Seus baralhos</h2><span>{notebook.decks.length}/100</span></div>
          <button className="button new-deck" disabled={editingBlocked} onClick={() => { setDraft({ title: '', front: '', back: '' }); openDialog({ type: 'deck' }); }}><Icon name="plus" />Novo baralho</button>
          <nav className="deck-list" aria-label="Escolher baralho">{notebook.decks.map(item => <button key={item.id} className={`deck-link ${item.id === selectedId ? 'selected' : ''}`} aria-current={item.id === selectedId ? 'page' : undefined} onClick={() => selectDeck(item.id)}><span className="deck-title">{item.title}</span><span className="deck-count">{item.cards.length} {item.cards.length === 1 ? 'cartão' : 'cartões'}<span className="due-count">{counts[item.id]} para hoje</span></span></button>)}</nav>
          {!notebook.decks.length && <p className="index-empty">Uma biblioteca que começa com as suas perguntas.</p>}
          <div className="backup-tools"><h3>Leve seu caderno</h3><p>Exporte uma cópia para guardar seus cartões fora deste navegador.</p><button className="text-button" onClick={() => exportBackup()} disabled={blocked}><Icon name="download" />Exportar backup</button><button className="text-button" disabled={leaseBlocked} onClick={() => fileInput.current?.click()}><Icon name="upload" />Importar backup</button><input className="visually-hidden" type="file" accept=".json,application/json" aria-label="Selecionar backup JSON" disabled={leaseBlocked} ref={fileInput} onChange={importFile} /><span className="file-hint">JSON · até 8 MiB</span></div>
          <p className="storage-caption">{saved ? 'Alterações salvas neste navegador.' : 'Dados somente neste navegador.'}<br />{' '}{totalCards} de 5.000 cartões.{lease === 'optimistic' && <><br />{' '}Para evitar conflitos, edite em uma aba por vez.</>}</p>
        </aside>
        <main id="conteudo" className="main-content" tabIndex="-1">
          <div className="feedback-area">
            {lease === 'checking' && <p className="live-notice" role="status">Conferindo acesso à edição…</p>}
            {lease === 'readonly' && <section className="warning-banner" role="alert"><p>Outra aba está editando este caderno. Esta aba está somente para leitura: você pode consultar, imprimir e exportar. Feche a outra aba para assumir a edição aqui.</p><div className="inline-actions"><button className="text-button" onClick={() => retryLease.current?.()}>Tentar assumir edição</button>{!conflict && <button className="text-button" onClick={() => openDialog({ type: 'reload' })}>Carregar versão salva</button>}</div></section>}
            {warning && <section className="warning-banner" role="alert"><p>{warning}</p><div className="inline-actions">{rawRecovery !== null && <button className="text-button" onClick={() => exportBackup(true)}>Baixar recuperação original</button>}{conflict ? <><button className="text-button" disabled={blocked} onClick={() => exportBackup()}>Exportar meu trabalho</button><button className="text-button" onClick={() => openDialog({ type: 'reload' })}>Carregar versão salva</button></> : blocked ? <button className="text-button danger-text" disabled={leaseBlocked} onClick={() => openDialog({ type: 'reset' })}>Remover dados inválidos</button> : <button className="text-button" onClick={() => exportBackup()}>Exportar backup agora</button>}</div></section>}
            {error && <p className="error-banner" role="alert">{error}</p>}
            <p className="live-notice" role="status" aria-live="polite">{notice}</p>
          </div>
          {!deck ? <section className="empty-workspace"><div className="empty-mark"><Icon name="book" width="48" height="48" /></div><h1>Um cartão<br />de cada vez.</h1><p>Transforme suas anotações em perguntas. Revise o que chegou à data, revele a resposta e escolha quando tentar de novo.</p><button className="button" disabled={editingBlocked} onClick={() => { setDraft({ title: '', front: '', back: '' }); openDialog({ type: 'deck' }); }}><Icon name="plus" />Criar meu primeiro baralho</button><button className="text-button" disabled={editingBlocked} onClick={loadExamples}>Experimentar com exemplos</button><p className="empty-footnote">Sem conta. Sem envio de dados. Exporte backups para não depender do armazenamento do navegador.</p></section> : <>
            <section className="deck-header"><div><h1>{deck.title}</h1><p>{deck.cards.length} {deck.cards.length === 1 ? 'cartão' : 'cartões'} · {due} para revisar até hoje</p></div><div className="deck-management"><button className="text-button" disabled={editingBlocked} onClick={() => { setDraft({ title: deck.title, front: '', back: '' }); openDialog({ type: 'deck', id: deck.id }); }}>Renomear</button><button className="text-button danger-text" disabled={editingBlocked} onClick={() => openDialog({ type: 'delete-deck', id: deck.id, count: deck.cards.length })}>Excluir baralho</button></div></section>
            <div className="mode-toolbar"><nav aria-label="Modo do baralho"><button className={!study ? 'mode-button active' : 'mode-button'} aria-current={!study ? 'page' : undefined} onClick={() => setStudy(null)}>Cartões</button><button className={study ? 'mode-button active' : 'mode-button'} aria-current={study ? 'page' : undefined} disabled={editingBlocked} onClick={startStudy}>Revisar <span>{due}</span></button></nav><span className="today-label">Hoje · {formatDate(today)}</span></div>
            <ol className="box-sequence" aria-label="Caixas de revisão">{INTERVALS.map((interval, index) => <li key={interval}><span className="box-name">Caixa {index + 1}</span><strong>{summary.boxCounts[deck.id][index]} <span>{summary.boxCounts[deck.id][index] === 1 ? 'cartão' : 'cartões'}</span></strong><small>{index === 0 ? 'Novos ou repetir' : `Intervalo de ${interval} dias`}</small></li>)}</ol>
            {study ? <section className="study-board" aria-label="Sessão de revisão">{current ? <>
              <div className="study-position"><span>Cartão {study.index + 1} de {study.ids.length}</span><span>Caixa {current.box}</span></div>
              <div className="question-face" key={current.id}><h2>{current.front}</h2>{study.revealed ? <div className="answer-face"><h3>Resposta</h3><p>{current.back}</p></div> : <p className="reveal-hint">Pense na resposta antes de revelar.</p>}</div>
              <div className="study-actions">{study.revealed ? <><button className="button board-secondary" onClick={() => answer('again')}>Repetir amanhã <kbd>1</kbd></button><button className="button board-primary" onClick={() => answer('remember')}>Lembrei <kbd>2</kbd><Icon name="arrow" /></button></> : <button className="button board-primary reveal-button" onClick={() => setStudy(value => ({ ...value, revealed: true }))}>Revelar resposta <kbd>Espaço</kbd></button>}</div>
              <p className="board-footnote">Lembrei avança uma caixa. Repetir volta à caixa 1. Os intervalos organizam a agenda, sem medir o que você aprendeu.</p>
            </> : <div className="study-finished"><span className="finished-mark"><Icon name="check" width="36" height="36" /></span><h2>{study.ids.length ? 'Revisão concluída.' : 'Você está em dia.'}</h2><p>{study.ids.length ? `${study.index} ${study.index === 1 ? 'cartão revisado' : 'cartões revisados'}. As próximas datas já estão na agenda.` : 'Não há cartões vencidos neste baralho para a data de hoje.'}</p><button className="button board-primary" onClick={() => setStudy(null)}>Voltar aos cartões</button></div>}</section> : <section className="cards-section" aria-label="Cartões do baralho">
              <div className="cards-toolbar"><label className="search-field"><Icon name="search" /><span className="visually-hidden">Buscar cartões</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar pergunta ou resposta" /></label><div className="inline-actions"><button className="text-button" disabled={!deck.cards.length} onClick={printDeck}><Icon name="print" />Imprimir</button><button className="button" disabled={editingBlocked} onClick={() => { setDraft({ title: '', front: '', back: '' }); openDialog({ type: 'card', deckId: deck.id }); }}><Icon name="plus" />Novo cartão</button></div></div>
              {!deck.cards.length ? <div className="cards-empty"><h2>Qual é a sua primeira pergunta?</h2><p>Uma ideia por cartão ajuda a manter a revisão focada. Escreva a pergunta na frente e a resposta no verso.</p></div> : !cards.length ? <div className="cards-empty"><h2>Nenhum cartão encontrado.</h2><p>Tente outra palavra ou limpe a busca.</p><button className="text-button" onClick={() => setSearch('')}>Limpar busca</button></div> : <ul className="card-list">{cards.map(card => <li key={card.id} className="card-row"><div className="card-copy"><h2>{card.front}</h2><p>{card.back}</p><span className="schedule-label">Caixa {card.box} · {card.due <= today ? 'Para revisar hoje' : `Próxima revisão: ${formatDate(card.due)}`}</span></div><div className="card-actions"><button className="text-button" disabled={editingBlocked} aria-label={`Editar cartão: ${card.front}`} onClick={() => { setDraft({ title: '', front: card.front, back: card.back }); openDialog({ type: 'card', id: card.id, deckId: deck.id }); }}>Editar</button><button className="text-button danger-text" disabled={editingBlocked} aria-label={`Excluir cartão: ${card.front}`} onClick={() => openDialog({ type: 'delete-card', id: card.id, deckId: deck.id })}>Excluir</button></div></li>)}</ul>}
            </section>}
            <p className="workspace-note">Organização por cinco caixas, com intervalos de 1, 3, 7, 14 e 30 dias. <a href="https://github.com/martinlofranodeoliveira/caderno-de-revisao" target="_blank" rel="noreferrer">Código aberto e documentação</a>.</p>
          </>}
        </main>
      </div>
      <footer className="app-footer"><span>Caderno de Revisão · MIT</span><span>Feito pela <a href="https://lofranotecnologia.com.br" target="_blank" rel="noreferrer">LOFRANO TECNOLOGIA</a>. Sem telemetria.</span></footer>
    </div>
    {printing && deck && <section className="print-sheet"><h1>{deck.title}</h1><p>Caderno de Revisão · Perguntas e respostas</p>{deck.cards.map((card, index) => <article className="print-card" key={card.id}><h2>{index + 1}. {card.front}</h2><p>{card.back}</p></article>)}</section>}
    {dialog && <Modal title={dialogTitle} onClose={closeDialog} returnFocus={dialog.returnFocus}>
      {dialog.type === 'deck' || dialog.type === 'card' ? <form onSubmit={submitEditor}>
        {dialog.type === 'deck' ? <label className="form-field">Nome do baralho<input name="title" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} required autoComplete="off" placeholder="Ex.: Biologia — células" /><span>Até 80 caracteres.</span></label> : <><label className="form-field">Pergunta<textarea name="front" value={draft.front} onChange={event => setDraft({ ...draft, front: event.target.value })} rows="3" required placeholder="O que você quer lembrar?" /><span>{[...draft.front].length}/2.000 caracteres</span></label><label className="form-field">Resposta<textarea name="back" value={draft.back} onChange={event => setDraft({ ...draft, back: event.target.value })} rows="5" required placeholder="Uma resposta clara, com suas palavras." /><span>{[...draft.back].length}/2.000 caracteres</span></label>{dialog.id && <p className="form-note">Editar o texto preserva a caixa e as datas de revisão.</p>}</>}
        {dialogError && <p role="alert" className="form-error">{dialogError}</p>}<div className="modal-actions"><button className="text-button" type="button" onClick={closeDialog}>Cancelar</button><button className="button" type="submit" disabled={leaseBlocked}>{dialog.type === 'deck' ? (dialog.id ? 'Salvar nome' : 'Criar baralho') : (dialog.id ? 'Salvar alterações' : 'Criar cartão')}</button></div>
      </form> : <>
        {dialog.type === 'delete-deck' && <p>Este baralho e {dialog.count === 1 ? 'seu' : 'seus'} {dialog.count} {dialog.count === 1 ? 'cartão serão excluídos' : 'cartões serão excluídos'}. Essa ação não pode ser desfeita. Exporte um backup antes, se quiser preservar uma cópia.</p>}
        {dialog.type === 'delete-card' && <p>O cartão e seu histórico de revisão serão excluídos. Essa ação não pode ser desfeita.</p>}
        {dialog.type === 'import' && <><p>O backup validado contém <strong>{dialog.candidate.decks.length} {dialog.candidate.decks.length === 1 ? 'baralho' : 'baralhos'}</strong> e <strong>{importedCount} {importedCount === 1 ? 'cartão' : 'cartões'}</strong>.</p><p>Confirmar substitui {notebook.decks.length} {notebook.decks.length === 1 ? 'baralho' : 'baralhos'} e {totalCards} {totalCards === 1 ? 'cartão' : 'cartões'} deste navegador. Não mescla os dados. Você pode cancelar e exportar seu caderno primeiro.{blocked ? ' Os dados locais inválidos também serão substituídos.' : ''}</p></>}
        {dialog.type === 'reset' && <p>Somente a chave de armazenamento deste aplicativo será removida. O arquivo original não poderá ser recuperado aqui depois. Baixe a recuperação antes de confirmar.</p>}
        {dialog.type === 'reload' && <p>Carregar a versão salva descarta as alterações em memória desta aba. A versão salva não será modificada. Cancele e exporte seu trabalho primeiro se quiser preservá-lo.</p>}
        {dialogError && <p role="alert" className="form-error">{dialogError}</p>}<div className="modal-actions"><button className="text-button" onClick={closeDialog}>Cancelar</button><button className={`button ${dialog.type.startsWith('delete') || dialog.type === 'reset' ? 'destructive' : ''}`} disabled={dialog.type !== 'reload' && leaseBlocked} onClick={confirmAction}>{dialog.type === 'import' ? 'Substituir dados' : dialog.type === 'reset' ? 'Remover somente estes dados' : dialog.type === 'reload' ? 'Descartar meu trabalho e carregar' : 'Excluir definitivamente'}</button></div>
      </>}
    </Modal>}
  </>;
}
