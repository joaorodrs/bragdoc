import { supabase } from './supabase';

export async function analyzePeriod(periodStart: string, periodEnd: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Entre novamente para analisar o diário.');

  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ periodStart, periodEnd, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Erro ${response.status}`);
  return payload as { created: number };
}
