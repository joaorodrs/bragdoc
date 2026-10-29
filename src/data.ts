import type { Achievement, AchievementFields, AchievementSuggestion, JournalEntry } from '../shared/domain';
import { supabase } from './supabase';

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('O Supabase não retornou dados.');
  return data as NonNullable<T>;
}

export async function listEntries(options: { search?: string; from?: string; to?: string; offset?: number; limit?: number } = {}) {
  let query = supabase.from('journal_entries').select('id,text,occurred_at,created_at,updated_at').order('occurred_at', { ascending: false });
  if (options.search?.trim()) query = query.ilike('text', `%${options.search.trim()}%`);
  if (options.from) query = query.gte('occurred_at', options.from);
  if (options.to) query = query.lt('occurred_at', options.to);
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  const rows = unwrap(await query.range(offset, offset + limit - 1));
  return rows.map((row) => ({ id: row.id, text: row.text, occurredAt: row.occurred_at, createdAt: row.created_at, updatedAt: row.updated_at })) as JournalEntry[];
}

export async function saveEntry(text: string, occurredAt: string) {
  unwrap(await supabase.from('journal_entries').insert({ text, occurred_at: occurredAt }).select('id').single());
}

export async function updateEntry(id: string, text: string, occurredAt: string) {
  unwrap(await supabase.from('journal_entries').update({ text, occurred_at: occurredAt }).eq('id', id).select('id').single());
}

async function entriesByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = unwrap(await supabase.from('journal_entries').select('id,text,occurred_at,created_at,updated_at').in('id', ids));
  return rows.map((row) => ({ id: row.id, text: row.text, occurredAt: row.occurred_at, createdAt: row.created_at, updatedAt: row.updated_at })) as JournalEntry[];
}

export async function listAchievements(): Promise<Achievement[]> {
  const rows = unwrap(await supabase.from('achievements').select('id,context_problem,my_action,result_impact,competencies,period_start,period_end,source,created_at,updated_at').order('period_end', { ascending: false }));
  const ids = rows.map((row) => row.id);
  const links = ids.length ? unwrap(await supabase.from('achievement_evidence').select('achievement_id,entry_id').in('achievement_id', ids)) : [];
  const entries = await entriesByIds(links.map((link) => link.entry_id));
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return rows.map((row) => ({
    id: row.id,
    contextProblem: row.context_problem,
    myAction: row.my_action,
    resultImpact: row.result_impact,
    competencies: row.competencies,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    source: row.source,
    evidence: links.filter((link) => link.achievement_id === row.id).map((link) => entriesById.get(link.entry_id)).filter((entry): entry is JournalEntry => Boolean(entry)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listPendingSuggestions(): Promise<AchievementSuggestion[]> {
  const rows = unwrap(await supabase.from('achievement_suggestions').select('id,context_problem,my_action,result_impact,competencies,period_start,period_end,status,created_at').eq('status', 'pending').order('created_at', { ascending: false }));
  const ids = rows.map((row) => row.id);
  const links = ids.length ? unwrap(await supabase.from('suggestion_evidence').select('suggestion_id,entry_id').in('suggestion_id', ids)) : [];
  const entries = await entriesByIds(links.map((link) => link.entry_id));
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return rows.map((row) => ({
    id: row.id,
    contextProblem: row.context_problem,
    myAction: row.my_action,
    resultImpact: row.result_impact,
    competencies: row.competencies,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    evidence: links.filter((link) => link.suggestion_id === row.id).map((link) => entriesById.get(link.entry_id)).filter((entry): entry is JournalEntry => Boolean(entry)),
    createdAt: row.created_at,
  }));
}

export async function reviewSuggestion(id: string, action: 'accept' | 'discard') {
  const suggestion = unwrap(await supabase.from('achievement_suggestions').select('id,context_problem,my_action,result_impact,competencies,period_start,period_end,status').eq('id', id).eq('status', 'pending').single()) as {
    context_problem: string;
    my_action: string;
    result_impact: string;
    competencies: string;
    period_start: string;
    period_end: string;
  };
  if (action === 'discard') {
    unwrap(await supabase.from('achievement_suggestions').update({ status: 'discarded' }).eq('id', id).eq('status', 'pending').select('id').single());
    return;
  }

  const created = unwrap(await supabase.from('achievements').insert({
    context_problem: suggestion.context_problem,
    my_action: suggestion.my_action,
    result_impact: suggestion.result_impact,
    competencies: suggestion.competencies,
    period_start: suggestion.period_start,
    period_end: suggestion.period_end,
    source: 'ai',
  }).select('id').single()) as unknown as { id: string };
  const links = unwrap(await supabase.from('suggestion_evidence').select('entry_id').eq('suggestion_id', id));
  if (links.length) {
    const inserted = await supabase.from('achievement_evidence').insert(links.map((link) => ({ achievement_id: created.id, entry_id: link.entry_id })));
    if (inserted.error) throw new Error(inserted.error.message);
  }
  unwrap(await supabase.from('achievement_suggestions').update({ status: 'accepted' }).eq('id', id).eq('status', 'pending').select('id').single());
}

export async function saveAchievement(fields: AchievementFields, evidenceIds: string[], existingId?: string) {
  const payload = {
    context_problem: fields.contextProblem,
    my_action: fields.myAction,
    result_impact: fields.resultImpact,
    competencies: fields.competencies,
    period_start: fields.periodStart,
    period_end: fields.periodEnd,
  };
  let id = existingId;
  if (id) {
    unwrap(await supabase.from('achievements').update(payload).eq('id', id).select('id').single());
  } else {
    const created = unwrap(await supabase.from('achievements').insert(payload).select('id').single()) as unknown as { id: string };
    id = created.id;
  }
  const deleted = await supabase.from('achievement_evidence').delete().eq('achievement_id', id);
  if (deleted.error) throw new Error(deleted.error.message);
  if (evidenceIds.length) {
    const inserted = await supabase.from('achievement_evidence').insert(evidenceIds.map((entry_id) => ({ achievement_id: id, entry_id })));
    if (inserted.error) throw new Error(inserted.error.message);
  }
}
