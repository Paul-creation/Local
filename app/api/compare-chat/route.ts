import { NextRequest, NextResponse } from 'next/server';
import { guardedClaudeFetch, AiLimitError } from '../../lib/aiGuard';
import { supabase } from '../../lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE: Record<string, string> = { steam: 'Steam', epic: '에픽', battlenet: 'Battle.net', riot: '라이엇' };

// 브라우저가 보낸 글 대신, 게임 ID로 DB에서 직접 정확한 정보를 만든다
async function buildGameInfo(ids: string[]) {
  if (!ids.length) return '';
  const { data } = await supabase
    .from('games')
    .select('id, name, source, steam_appid, tags, difficulty, min_players, max_players, recommended_players, solo_playable, korean_support, activities, is_free, description')
    .in('id', ids);
  return ids
    .map((id) => (data || []).find((g: any) => g.id === id))
    .filter(Boolean)
    .map((g: any) => [
      `[${g.name}]`,
      `스토어: ${g.steam_appid ? 'Steam' : STORE[g.source] || 'PC'}${g.is_free ? ' (무료)' : ''}`,
      `인원: ${g.min_players ?? '?'}-${g.max_players ?? '?'}인${g.recommended_players ? ` (추천 ${g.recommended_players})` : ''}`,
      `혼자 플레이: ${g.solo_playable === true ? '가능' : g.solo_playable === false ? '사실상 친구 필요' : '정보 없음'}`,
      `난이도: ${g.difficulty || '정보 없음'} / 한국어: ${g.korean_support || '정보 없음'}`,
      `태그: ${(g.tags || []).slice(0, 6).join(', ')}`,
      g.activities?.length ? `할 수 있는 것: ${g.activities.slice(0, 5).join(', ')}` : '',
      `설명: ${String(g.description || '').replace(/\s+/g, ' ').slice(0, 160)}`,
    ].filter(Boolean).join('\n'))
    .join('\n\n');
}

async function handlePOST(req: NextRequest) {
  const raw = await req.json();
  // 긴 입력으로 토큰을 낭비하지 못하게 자르기
  const question = String(raw.question || '').slice(0, 100);
  const ids = (Array.isArray(raw.gameIds) ? raw.gameIds : []).filter((x: any) => typeof x === 'string' && UUID.test(x)).slice(0, 3);
  const gameInfo = ids.length ? await buildGameInfo(ids) : String(raw.gameInfo || '').slice(0, 600);
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .slice(-6)
    .map((m: any) => ({ role: m?.role, text: String(m?.text || '').slice(0, 500) }));
  if (!question.trim()) return NextResponse.json({ answer: '질문을 입력해주세요.' });

  const historyText = history.map((m: any) =>
    `${m.role === 'user' ? '유저' : 'AI'}: ${m.text}`
  ).join('\n');

  const prompt = `너는 게임 전문가야. 아래 게임들에 대한 질문에 친근한 반말로 답해줘.

게임 정보:
${gameInfo}

이전 대화:
${historyText || '없음'}

유저 질문: ${question}

2-3문장으로 핵심만 답해줘. 위 게임 정보를 우선으로 쓰고, 정보에 없는 건 널리 알려진 사실만 말해. 확실하지 않으면 단정하지 마. 텍스트만 출력.`;

  const res = await guardedClaudeFetch(req.headers, 'compare-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  const answer = data.content?.[0]?.text?.trim() || '답변을 가져오지 못했어요.';

  return NextResponse.json({ answer });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePOST(req);
  } catch (e) {
    if (e instanceof AiLimitError) {
      return NextResponse.json({ error: e.message, answer: e.message }, { status: 429 });
    }
    throw e;
  }
}
