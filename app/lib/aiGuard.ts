// AI 호출 보호: IP별 하루 횟수 제한 + 사이트 전체 하루 상한
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AiLimitError extends Error {}

// 한 사람(IP)이 하루에 쓸 수 있는 AI 호출 횟수
const PER_IP_DAILY: Record<string, number> = {
  recommend: 3,
  'compare-chat': 10,
  'compare-scores': 10,
};
// 사이트 전체 하루 상한
const GLOBAL_DAILY = 150;

export function getIp(h: Headers) {
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

export async function guardedClaudeFetch(ip: string, kind: string, init: RequestInit) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [mine, all] = await Promise.all([
    admin.from('ai_calls').select('id', { count: 'exact', head: true }).eq('ip', ip).eq('kind', kind).gte('created_at', since),
    admin.from('ai_calls').select('id', { count: 'exact', head: true }).gte('created_at', since),
  ]);

  if ((all.count ?? 0) >= GLOBAL_DAILY) {
    throw new AiLimitError('오늘은 AI 사용량이 많아 잠시 쉬고 있어요. 내일 다시 이용해주세요.');
  }
  if ((mine.count ?? 0) >= (PER_IP_DAILY[kind] ?? 3)) {
    throw new AiLimitError('오늘 사용할 수 있는 AI 횟수를 다 썼어요. 내일 다시 이용해주세요.');
  }

  await admin.from('ai_calls').insert({ ip, kind });
  return fetch('https://api.anthropic.com/v1/messages', init);
}
