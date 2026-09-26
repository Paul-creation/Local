import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { question, gameInfo, history } = await req.json();

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
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