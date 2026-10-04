// AI 호출 보호: 브라우저별 하루 횟수 제한 + IP별 느슨한 상한 + 사이트 전체 하루 상한
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { readAiClientId } from './aiClient';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AiLimitError extends Error {}

// 1차 기준: 브라우저(익명 쿠키 ID)별 하루 횟수 — 공용 IP(사지방·학교·회사·모바일)에서 남의 사용분이 섞이지 않게
// AI 추천은 한 번에 AI를 여러 번 부르므로(질문마다 1번, 최대 8번) 시작(recommend)만 횟수로 세고,
// 이어지는 질문·결과(recommend-step)는 3번 × 7번까지 따로 막음
const PER_CLIENT_DAILY: Record<string, number> = {
  recommend: 3,
  'recommend-step': 21,
  'compare-chat': 10,
  'compare-scores': 10,
};
// 2차 기준: 같은 IP 하루 상한 (쿠키를 지워 가며 남용하는 것만 막는 느슨한 값, recommend-step은 빼고 셈)
const PER_IP_DAILY = 30;
// 사이트 전체 하루 상한 (AI 호출 수)
const GLOBAL_DAILY = 150;

export function getIp(h: Headers) {
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

// IP 원문은 저장하지 않고 비밀 값을 섞은 해시만 저장 (커뮤니티·투표와 같은 방식, 90일 뒤 scripts/purge-ip-hash.mjs가 비움)
export const ipHash = (ip: string) =>
  createHash('sha256').update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')).digest('hex').slice(0, 32);

const count = (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) =>
  Promise.resolve(q).then(({ count, error }) => {
    if (error) console.error('AI 한도 조회 실패:', error.message);
    return count ?? 0;
  });

// h: 요청 헤더 (IP와 익명 쿠키를 읽음)
export async function guardedClaudeFetch(h: Headers, kind: string, init: RequestInit) {
  const clientId = readAiClientId(h);
  if (!clientId) {
    throw new AiLimitError('브라우저 확인이 필요해요. 쿠키를 허용한 뒤 페이지를 새로고침해 주세요.');
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const ipKey = ipHash(getIp(h));
  const clientKey = ipHash('client:' + clientId);
  const calls = () => admin.from('ai_calls').select('id', { count: 'exact', head: true }).gte('created_at', since);

  // null 칸은 eq에 걸리지 않으므로 IP·ID가 비워진 예전 행이 한 사람으로 묶이지 않음
  const [mine, myStarts, ipUses, all] = await Promise.all([
    count(calls().eq('client_id', clientKey).eq('kind', kind)),
    kind === 'recommend-step' ? count(calls().eq('client_id', clientKey).eq('kind', 'recommend')) : Promise.resolve(1),
    count(calls().eq('ip', ipKey).neq('kind', 'recommend-step')),
    count(calls()),
  ]);
  // 시작 없이 이어지는 단계만 보내는 요청은 시작으로 셈
  if (kind === 'recommend-step' && myStarts === 0) return guardedClaudeFetch(h, 'recommend', init);

  if (all >= GLOBAL_DAILY) {
    throw new AiLimitError('오늘은 사이트 전체 AI 사용량이 다 찼어요. 내일 다시 이용해 주세요.');
  }
  if (mine >= (PER_CLIENT_DAILY[kind] ?? 3)) {
    throw new AiLimitError(`오늘 ${kind.startsWith('recommend') ? 'AI 추천' : '이 AI 기능'}의 내 사용 횟수를 다 썼어요. 내일 다시 이용해 주세요.`);
  }
  if (kind !== 'recommend-step' && ipUses >= PER_IP_DAILY) {
    throw new AiLimitError('같은 네트워크에서 오늘 AI를 너무 많이 써서 잠시 막혔어요. 내일 다시 이용해 주세요.');
  }

  const { error } = await admin.from('ai_calls').insert({ ip: ipKey, client_id: clientKey, kind });
  if (error) console.error('AI 사용 기록 실패:', error.message);
  const res = await fetch('https://api.anthropic.com/v1/messages', init);
  // 잔액 부족·월 한도 같은 Anthropic 오류는 사용자 한도와 다르므로 로그로 구분해 둠 (화면에는 한도 문구를 띄우지 않음)
  if (!res.ok) console.error(`Anthropic 오류 (${kind}) ${res.status}:`, await res.clone().text().catch(() => ''));
  return res;
}
