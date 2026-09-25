import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 기존 방식 호환
  if (body.mood) {
    return handleLegacy(body);
  }

  // 아키네이터 방식
  const { answers = [] } = body;

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, cover_image_url, category, tags, min_players, max_players, difficulty, is_free, solo_playable, korean_support');

  if (error || !games) {
    return NextResponse.json({ error: '게임 목록을 불러오지 못했어요.' }, { status: 500 });
  }

  const gameList = games.map((g) =>
    `id:${g.id} | 이름:${g.name} | 카테고리:${g.category} | 태그:${(g.tags || []).join(',')} | 인원:${g.min_players}-${g.max_players} | 난이도:${g.difficulty} | 무료:${g.is_free} | 솔로:${g.solo_playable} | 한국어:${g.korean_support}`
  ).join('\n');

  const answersText = answers.length > 0
    ? answers.map((a: any) => `Q: ${a.question} → A: ${a.answer}`).join('\n')
    : '(아직 없음)';

  const prompt = `너는 게임 추천 아키네이터야. 사용자의 답변을 바탕으로 게임 후보를 좁혀가며 질문해.

지금까지 답변:
${answersText}

전체 게임 목록:
${gameList}

규칙:
- 답변이 없거나 2개 이하면 반드시 다음 질문을 생성해
- 후보가 3개 이하로 줄었거나 답변이 5개 이상이면 최종 추천
- 질문은 예/아니오 또는 2-4개 보기로 만들어
- 이미 물어본 것은 다시 묻지 마
- 후보 게임 수도 알려줘

질문이 필요하면:
{"type":"question","question":"질문 내용","options":["보기1","보기2","보기3"],"remaining":후보게임수}

최종 추천이면:
{"type":"result","game_id":"게임id","reason":"추천 이유 2문장, 친근한 반말로","remaining":1}

JSON만 출력, 다른 말 없이.`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const aiData = await aiRes.json();

  if (!aiRes.ok) {
    return NextResponse.json({ error: `AI 호출 실패: ${aiData.error?.message}` }, { status: 500 });
  }

  const text = aiData.content?.[0]?.text || '';

  let parsed;
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
  }

  if (parsed.type === 'question') {
    return NextResponse.json({
      question: parsed.question,
      options: parsed.options,
      remaining: parsed.remaining,
    });
  }

  if (parsed.type === 'result') {
    const game = games.find((g) => g.id === parsed.game_id);
    if (!game) return NextResponse.json({ error: '게임을 찾지 못했어요.' }, { status: 500 });
    return NextResponse.json({ done: true, game, reason: parsed.reason });
  }

  return NextResponse.json({ error: '알 수 없는 응답 형식' }, { status: 500 });
}

async function handleLegacy(body: any) {
  const { mood, groupSize, vibe } = body;

  const { data: games } = await supabase
    .from('games')
    .select('id, name, cover_image_url, category, tags, min_players, max_players, difficulty');

  if (!games) return NextResponse.json({ error: '게임 목록을 불러오지 못했어요.' }, { status: 500 });

  const gameList = games.map((g) =>
    `- id: ${g.id}, 이름: ${g.name}, 카테고리: ${g.category}, 태그: ${(g.tags || []).join(', ')}, 인원: ${g.min_players}-${g.max_players}, 난이도: ${g.difficulty}`
  ).join('\n');

  const prompt = `너는 게임 추천 도우미야. 아래 사용자 응답과 게임 목록을 보고, 가장 잘 맞는 게임 1개를 골라줘.

사용자 응답:
- 오늘 기분: ${mood}
- 같이 할 인원수: ${groupSize}
- 원하는 분위기: ${vibe}

게임 목록:
${gameList}

아래 JSON 형식으로만 답해:
{"game_id": "선택한 게임의 id", "reason": "왜 이 게임을 골랐는지, 친근한 반말로 2문장 이내."}`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
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

  const aiData = await aiRes.json();
  const text = aiData.content?.[0]?.text || '';

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
  }

  const game = games.find((g) => g.id === parsed.game_id);
  if (!game) return NextResponse.json({ error: '추천 결과를 찾지 못했어요.' }, { status: 500 });

  return NextResponse.json({ game, reason: parsed.reason });
}