'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { analyzePeriod } from './ai';
import { listAchievements, listEntries, listPendingSuggestions, reviewSuggestion as persistSuggestionReview, saveAchievement as persistAchievement, saveEntry, updateEntry } from './data';
import { supabase } from './supabase';
import {
  emptyAchievement,
  type Achievement,
  type AchievementFields,
  type AchievementSuggestion,
  type JournalEntry,
} from '../shared/domain';

type Section = 'journal' | 'achievements' | 'review';

function localInputValue(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function dateInput(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function isoDateStart(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function isoDateEndExclusive(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function ErrorNotice({ message }: { message: string }) {
  return <div className="notice notice-error" role="alert">{message}</div>;
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <BrandMark />
        <p className="eyebrow">SEU REGISTRO PROFISSIONAL</p>
        <h1>Bom ter você de volta</h1>
        <p className="muted auth-intro">
          Entre para continuar seu diário de trabalho.
        </p>
        {error && <ErrorNotice message={error} />}
        <form className="stack-form" onSubmit={submit}>
          <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Senha<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Aguarde…' : 'Entrar'}</button>
        </form>
        <p className="auth-footnote">Um espaço privado para guardar o trabalho que acontece entre as grandes entregas.</p>
      </div>
    </main>
  );
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true">b<span>•</span></div>;
}

function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [section, setSection] = useState<Section>('journal');
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try { setPendingCount((await listPendingSuggestions()).length); }
    catch { setPendingCount(0); }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setEmail(data.session?.user.email ?? null);
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setAuthLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (email) void refreshPendingCount(); }, [email, refreshPendingCount]);

  async function logout() {
    await supabase.auth.signOut();
  }

  if (authLoading) return <main className="auth-shell"><div className="loading-line">Abrindo seu diário…</div></main>;
  if (!email) return <LoginScreen />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><BrandMark /><span>bragdoc</span></div>
        <div className="sidebar-label">ESPAÇO PESSOAL</div>
        <nav aria-label="Navegação principal" className="main-nav">
          <button className={section === 'journal' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('journal')}>
            <span className="nav-icon">◷</span><span>Diário</span>
          </button>
          <button className={section === 'achievements' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('achievements')}>
            <span className="nav-icon">✳</span><span>Conquistas</span>
          </button>
          <button className={section === 'review' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('review')}>
            <span className="nav-icon">⌑</span><span>Para revisar</span>
            {pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><span className="privacy-dot" />Seu espaço privado</div>
          <div className="user-card">
            <div className="avatar">{email.charAt(0).toUpperCase()}</div>
            <div className="user-meta"><strong>{email}</strong><span>Conta pessoal</span></div>
            <button className="icon-button logout-button" title="Sair" aria-label="Sair" onClick={logout}>↗</button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><BrandMark /><span>bragdoc</span></div>
          <span className="topbar-caption">Seu trabalho, visto com mais clareza.</span>
          <div className="topbar-date">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</div>
        </header>
        {section === 'journal' && <JournalPage />}
        {section === 'achievements' && <AchievementsPage />}
        {section === 'review' && <ReviewPage onCountChange={setPendingCount} />}
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-copy">{copy}</p></div>
      {action}
    </div>
  );
}

function JournalPage() {
  const [focusMode, setFocusMode] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [text, setText] = useState('');
  const [occurredAt, setOccurredAt] = useState(localInputValue(new Date()));
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const requestSequence = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusMode) composerRef.current?.focus();
  }, [focusMode]);

  const loadEntries = useCallback(async (nextOffset = 0, append = false) => {
    const requestId = ++requestSequence.current;
    try {
      const page = await listEntries({ search, from: from ? isoDateStart(from) : undefined, to: to ? isoDateEndExclusive(to) : undefined, offset: nextOffset, limit: 50 });
      if (requestId !== requestSequence.current) return;
      setEntries((current) => append ? [...current, ...page] : page);
      setOffset(nextOffset + page.length);
      setHasMore(page.length === 50);
      setError('');
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as entradas.');
      }
    }
  }, [search, from, to]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveEntry(text, new Date(occurredAt).toISOString());
      setText('');
      setOccurredAt(localInputValue(new Date()));
      await loadEntries();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a entrada.');
    } finally { setBusy(false); }
  }

  async function saveEdit(id: string, nextText: string, nextDate: string) {
    await updateEntry(id, nextText, new Date(nextDate).toISOString());
    setEditing(null);
    await loadEntries();
  }

  return (
    <div className={`page-wrap journal-page${focusMode ? ' focus-mode' : ''}`}>
      {!focusMode && <PageIntro eyebrow="DIÁRIO DE TRABALHO" title="O que aconteceu hoje?" copy="Uma página para tirar o trabalho da cabeça e colocar no papel. Comece por uma coisa que aconteceu hoje." />}
      {error && <ErrorNotice message={error} />}
      <form className="entry-composer" onSubmit={addEntry}>
        <div className="composer-top">
          <div className="composer-title"><span className="composer-mark">✎</span><span><strong>DIÁRIO DE TRABALHO</strong><small>Uma página de cada vez</small></span></div>
          <button className="focus-toggle" type="button" aria-pressed={focusMode} onClick={() => setFocusMode((current) => !current)}>{focusMode ? '↙ Voltar ao diário' : '⛶ Modo foco'}</button>
        </div>
        <textarea
          ref={composerRef}
          aria-label="Escreva uma entrada para o diário"
          placeholder="Comece por uma frase… o resto vem enquanto você escreve."
          value={text}
          maxLength={10000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && focusMode) setFocusMode(false);
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          required
        />
        <div className="composer-note">Escreva do seu jeito. Não precisa ficar perfeito.</div>
        <div className="composer-bottom">
          <label className="datetime-label">Data e hora <input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></label>
          <span className="char-count">{text.length}/10.000</span>
          <button className="button button-primary composer-submit" disabled={busy || !text.trim()}>{busy ? 'Salvando…' : 'Guardar no diário'} <span>↗</span></button>
        </div>
      </form>

      {!focusMode && <>
        <div className="list-heading"><div><h2>Suas entradas</h2><span>{entries.length} {entries.length === 1 ? 'registro' : 'registros'}</span></div></div>
        <div className="filter-bar">
          <label className="search-field"><span>⌕</span><input type="search" placeholder="Buscar no diário" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>De <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Até <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          {(from || to || search) && <button className="text-button" type="button" onClick={() => { setFrom(''); setTo(''); setSearch(''); }}>Limpar filtros</button>}
        </div>
        <div className="entry-list">
          {entries.map((entry) => editing === entry.id
            ? <EntryEdit key={entry.id} entry={entry} onCancel={() => setEditing(null)} onSave={(nextText, nextDate) => saveEdit(entry.id, nextText, nextDate)} />
            : <article className="entry-card" key={entry.id}>
              <div className="entry-timeline"><span className="timeline-dot" /></div>
              <div className="entry-body"><div className="entry-date">{displayDateTime(entry.occurredAt)}</div><p>{entry.text}</p></div>
              <button className="text-button entry-edit" onClick={() => setEditing(entry.id)}>Editar</button>
            </article>)}
          {!entries.length && <div className="empty-state"><span className="empty-icon">◷</span><h3>Seu diário começa por aqui</h3><p>Adicione uma nota acima. Você pode registrar várias coisas ao longo do dia.</p></div>}
        </div>
        {hasMore && <div className="load-more-wrap"><button className="button button-quiet" onClick={() => void loadEntries(offset, true)}>Carregar entradas anteriores</button></div>}
      </>}
    </div>
  );
}

function EntryEdit({ entry, onCancel, onSave }: { entry: JournalEntry; onCancel: () => void; onSave: (text: string, date: string) => Promise<void> }) {
  const [text, setText] = useState(entry.text);
  const [date, setDate] = useState(localInputValue(entry.occurredAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(text, date); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }
  return <form className="entry-card entry-edit-form" onSubmit={submit}>
    <div className="entry-timeline"><span className="timeline-dot" /></div>
    <div className="entry-body"><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={10000} required />
      <label className="datetime-label">Data e hora <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
      {error && <ErrorNotice message={error} />}
      <div className="form-actions"><button className="button button-primary" disabled={busy}>Salvar alterações</button><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button></div>
    </div>
  </form>;
}

function AchievementCard({ achievement, onEdit }: { achievement: Achievement; onEdit: () => void }) {
  return <article className="achievement-card">
    <div className="achievement-card-head"><div className="achievement-symbol">✳</div><span className={achievement.source === 'ai' ? 'source-pill source-ai' : 'source-pill'}>{achievement.source === 'ai' ? 'Sugestão revisada' : 'Manual'}</span><button className="text-button" onClick={onEdit}>Editar</button></div>
    <div className="achievement-grid">
      <AchievementField label="Contexto / Problema" value={achievement.contextProblem} />
      <AchievementField label="Minha atuação" value={achievement.myAction} />
      <AchievementField label="Resultado / Impacto" value={achievement.resultImpact} />
      <AchievementField label="Competências demonstradas" value={achievement.competencies} />
    </div>
    <div className="achievement-card-foot"><span className="period-chip">◷ {displayDate(achievement.periodStart)} — {displayDate(achievement.periodEnd)}</span><span>{achievement.evidence.length} {achievement.evidence.length === 1 ? 'evidência' : 'evidências'}</span></div>
    {achievement.evidence.length > 0 && <details className="evidence-details"><summary>Ver registros relacionados</summary><ul>{achievement.evidence.map((entry) => <li key={entry.id}><time>{displayDateTime(entry.occurredAt)}</time>{entry.text}</li>)}</ul></details>}
  </article>;
}

function AchievementField({ label, value }: { label: string; value: string }) {
  return <div className="achievement-field"><span>{label}</span><p>{value || <em>Não preenchido</em>}</p></div>;
}

function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [editing, setEditing] = useState<Achievement | null | 'new'>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setAchievements(await listAchievements()); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as conquistas.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveAchievement(fields: AchievementFields, evidenceIds: string[]) {
    try {
      if (editing) await persistAchievement(fields, evidenceIds, editing === 'new' ? undefined : editing.id);
      setEditing(null);
      await load();
    } catch (reason) { throw reason; }
  }

  return <div className="page-wrap">
    <PageIntro eyebrow="CONQUISTAS" title="O trabalho que merece ficar" copy="Reúna resultados, aprendizados e evidências em histórias que você pode revisitar." action={<button className="button button-primary" onClick={() => setEditing('new')}>＋ Nova conquista</button>} />
    {error && <ErrorNotice message={error} />}
    {editing && <AchievementEditor achievement={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={saveAchievement} />}
    <div className="achievement-list">
      {achievements.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} onEdit={() => setEditing(achievement)} />)}
      {!achievements.length && <div className="empty-state"><span className="empty-icon">✳</span><h3>Suas conquistas, no seu ritmo</h3><p>Reúna resultados, aprendizados e registros relacionados em conquistas criadas por você.</p><button className="button button-secondary" onClick={() => setEditing('new')}>Criar primeira conquista</button></div>}
    </div>
  </div>;
}

function ReviewPage({ onCountChange }: { onCountChange: (count: number) => void }) {
  const [suggestions, setSuggestions] = useState<AchievementSuggestion[]>([]);
  const [start, setStart] = useState(() => {
    const date = new Date(); date.setDate(1); return dateInput(date);
  });
  const [end, setEnd] = useState(dateInput(new Date()));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await listPendingSuggestions();
      setSuggestions(items);
      onCountChange(items.length);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as sugestões.');
    }
  }, [onCountChange]);
  useEffect(() => { void load(); }, [load]);

  async function analyze(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await analyzePeriod(start, end);
      setNotice(result.created ? `${result.created} ${result.created === 1 ? 'sugestão chegou' : 'sugestões chegaram'} para revisão.` : 'Não encontramos uma conquista clara nesse período.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível analisar o período.');
    } finally { setBusy(false); }
  }

  async function review(id: string, action: 'accept' | 'discard') {
    setError('');
    try { await persistSuggestionReview(id, action); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível revisar a sugestão.'); }
  }

  return <div className="page-wrap">
    <PageIntro eyebrow="REVISÃO HUMANA" title="Possíveis conquistas" copy="Peça à IA para encontrar histórias no diário. Escolha um período e revise cada sugestão antes que ela entre nas suas conquistas." />
    <form className="analysis-panel" onSubmit={analyze}>
      <div className="analysis-copy"><span className="ai-orb">✳</span><div><h2>Encontrar histórias no diário</h2><p>Somente as entradas deste período serão enviadas para análise.</p></div></div>
      <div className="analysis-controls"><label>De<input type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} required /></label><label>Até<input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} required /></label><button className="button button-primary" disabled={busy || !start || !end}>{busy ? 'Analisando…' : 'Analisar período'} <span>✦</span></button></div>
    </form>
    {error && <ErrorNotice message={error} />}
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
    <div className="list-heading"><div><h2>Fila de revisão</h2><span>{suggestions.length} {suggestions.length === 1 ? 'sugestão pendente' : 'sugestões pendentes'}</span></div></div>
    <div className="suggestion-list">
      {suggestions.map((suggestion) => <SuggestionCard key={suggestion.id} suggestion={suggestion} onAccept={() => review(suggestion.id, 'accept')} onDiscard={() => review(suggestion.id, 'discard')} />)}
      {!suggestions.length && <div className="empty-state review-empty"><span className="empty-icon">⌑</span><h3>Nenhuma sugestão aguardando</h3><p>Escolha um período acima para procurar possíveis conquistas nas suas entradas.</p></div>}
    </div>
  </div>;
}

function SuggestionCard({ suggestion, onAccept, onDiscard }: { suggestion: AchievementSuggestion; onAccept: () => void; onDiscard: () => void }) {
  return <article className="suggestion-card">
    <div className="suggestion-card-head"><div className="ai-orb small-orb">✳</div><div><span className="eyebrow">SUGESTÃO DA IA</span><span className="suggestion-period">{displayDate(suggestion.periodStart)} — {displayDate(suggestion.periodEnd)}</span></div><span className="pending-pill">Aguardando revisão</span></div>
    <div className="achievement-grid"><AchievementField label="Contexto / Problema" value={suggestion.contextProblem} /><AchievementField label="Minha atuação" value={suggestion.myAction} /><AchievementField label="Resultado / Impacto" value={suggestion.resultImpact} /><AchievementField label="Competências demonstradas" value={suggestion.competencies} /></div>
    <div className="suggestion-evidence"><h3>Entradas que fundamentam esta sugestão <span>{suggestion.evidence.length}</span></h3><ul>{suggestion.evidence.map((entry) => <li key={entry.id}><time>{displayDateTime(entry.occurredAt)}</time><span>{entry.text}</span></li>)}</ul></div>
    <div className="suggestion-actions"><p>Você poderá editar a conquista e seus vínculos depois de aceitar.</p><div><button className="button button-quiet" onClick={onDiscard}>Descartar</button><button className="button button-primary" onClick={onAccept}>Aceitar sugestão <span>✓</span></button></div></div>
  </article>;
}

function AchievementEditor({ achievement, onClose, onSave }: { achievement: Achievement | null; onClose: () => void; onSave: (fields: AchievementFields, evidenceIds: string[]) => Promise<void> }) {
  const [fields, setFields] = useState<AchievementFields>(achievement ? {
    contextProblem: achievement.contextProblem,
    myAction: achievement.myAction,
    resultImpact: achievement.resultImpact,
    competencies: achievement.competencies,
    periodStart: achievement.periodStart,
    periodEnd: achievement.periodEnd,
  } : { ...emptyAchievement, periodStart: dateInput(new Date()), periodEnd: dateInput(new Date()) });
  const [selected, setSelected] = useState<string[]>(achievement?.evidence.map((entry) => entry.id) ?? []);
  const [available, setAvailable] = useState<JournalEntry[]>(achievement?.evidence ?? []);
  const [entrySearch, setEntrySearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      listEntries({ limit: 250, search: entrySearch }).then((entries) => {
        const merged = new Map<string, JournalEntry>();
        [...available, ...entries].forEach((entry) => merged.set(entry.id, entry));
        setAvailable([...merged.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
      }).catch(() => undefined);
    }, 200);
    return () => clearTimeout(timer);
  }, [entrySearch]);

  function update<K extends keyof AchievementFields>(key: K, value: AchievementFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave(fields, selected); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="editor-modal" onSubmit={submit}>
      <div className="modal-head"><div><p className="eyebrow">CONQUISTA</p><h2>{achievement ? 'Editar conquista' : 'Nova conquista'}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>×</button></div>
      {error && <ErrorNotice message={error} />}
      <div className="editor-fields">
        <label>Contexto / Problema<textarea value={fields.contextProblem} onChange={(event) => update('contextProblem', event.target.value)} rows={3} /></label>
        <label>Minha atuação<textarea value={fields.myAction} onChange={(event) => update('myAction', event.target.value)} rows={3} /></label>
        <label>Resultado / Impacto<textarea value={fields.resultImpact} onChange={(event) => update('resultImpact', event.target.value)} rows={3} /></label>
        <label>Competências demonstradas<textarea value={fields.competencies} onChange={(event) => update('competencies', event.target.value)} rows={2} placeholder="Ex.: colaboração entre áreas, análise de dados…" /></label>
        <div className="date-pair"><label>Início do período<input type="date" value={fields.periodStart} onChange={(event) => update('periodStart', event.target.value)} required /></label><label>Fim do período<input type="date" value={fields.periodEnd} onChange={(event) => update('periodEnd', event.target.value)} required /></label></div>
      </div>
      <section className="evidence-picker"><div className="evidence-picker-head"><div><h3>Entradas relacionadas</h3><p>Escolha registros que sustentam esta conquista.</p></div><span className="selected-count">{selected.length} selecionadas</span></div>
        <label className="search-field"><span>⌕</span><input type="search" placeholder="Buscar entradas" value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} /></label>
        <div className="evidence-options">{available.map((entry) => <label className="evidence-option" key={entry.id}><input type="checkbox" checked={selected.includes(entry.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, entry.id] : current.filter((id) => id !== entry.id))} /><span><time>{displayDateTime(entry.occurredAt)}</time><span>{entry.text}</span></span></label>)}{!available.length && <p className="muted small-copy">Nenhuma entrada encontrada.</p>}</div>
      </section>
      <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar conquista'}</button></div>
    </form>
  </div>;
}

export default App;

