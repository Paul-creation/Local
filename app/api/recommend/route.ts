import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { mood, groupSize, vibe } = await req.json();

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, cover_image_url, category, tags, min_players, max_players, difficulty');

  if (error || !games) {
    console.error('Supabase 조회 에러:', error);
    return NextResponse.json({ error: '게임 목록을 불러오지 못했어요.' }, { status: 500 });
  }

  const gameList = games
    .map(
      (g) =>
        `- id: ${g.id}, 이름: ${g.name}, 카테고리: ${g.category}, 태그: ${(g.tags || []).join(', ')}, 인원: ${g.min_players}-${g.max_players}, 난이도: ${g.difficulty}`
    )
    .join('\n');

  const prompt = `너는 게임 추천 도우미야. 아래 사용자 응답과 게임 목록을 보고, 가장 잘 맞는 게임 1개를 골라줘.

사용자 응답:
- 오늘 기분: ${mood}
- 같이 할 인원수: ${groupSize}
- 원하는 분위기: ${vibe}

게임 목록:
${gameList}

아래 JSON 형식으로만 답해, 다른 말은 절대 붙이지 마:
{"game_id": "선택한 게임의 id", "reason": "왜 이 게임을 골랐는지, 친근한 반말로 2문장 이내. '~하는 게임인데 ~에요!' 같은 톤으로."}`;

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

  if (!aiRes.ok) {
    console.error('Anthropic API 에러:', aiData);
    return NextResponse.json(
      { error: `AI 호출 실패: ${aiData.error?.message || '알 수 없는 오류'}` },
      { status: 500 }
    );
  }

  const text = aiData.content?.[0]?.text || '';
  console.log('AI 원본 응답:', text);

  let parsed;
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('JSON 파싱 실패, 원본 텍스트:', text);
    return NextResponse.json({ error: 'AI 응답을 이해하지 못했어요. 다시 시도해줘.' }, { status: 500 });
  }

  const matchedGame = games.find((g) => g.id === parsed.game_id);

  if (!matchedGame) {
    console.error('매칭되는 게임을 못 찾음. AI가 준 game_id:', parsed.game_id);
    return NextResponse.json({ error: '추천 결과를 찾지 못했어요.' }, { status: 500 });
  }

  return NextResponse.json({ game: matchedGame, reason: parsed.reason });
}