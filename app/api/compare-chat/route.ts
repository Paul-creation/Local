import { NextRequest, NextResponse } from 'next/server';
import { guardedClaudeFetch, getIp, AiLimitError } from '../../lib/aiGuard';

async function handlePOST(req: NextRequest) {
  const raw = await req.json();
  // 긴 입력으로 토큰을 낭비하지 못하게 자르기
  const question = String(raw.question || '').slice(0, 100);
  const gameInfo = String(raw.gameInfo || '').slice(0, 600);
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .slice(-6)
    .map((m: any) => ({ role: m?.role, text: String(m?.text || '').slice(0, 500) }));
  if (!question.trim()) return NextResponse.json({ answer: '질문을 입력해주세요.' });
  const ip = getIp(req.headers);

  const historyText = history.map((m: any) =>
    `${m.role === 'user' ? '유저' : 'AI'}: ${m.text}`
  ).join('\n');

  const prompt = `너는 게임 전문가야. 아래 게임들에 대한 질문에 친근한 반말로 답해줘.

게임 정보:
${gameInfo}

이전 대화:
${historyText || '없음'}

유저 질문: ${question}

2-3문장으로 핵심만 답해줘. 텍스트만 출력.`;

  const res = await guardedClaudeFetch(ip, 'compare-chat', {
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
