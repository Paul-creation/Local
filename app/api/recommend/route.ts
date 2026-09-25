import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.mood) return handleLegacy(body);

  const { answers = [] } = body;

  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, cover_image_url, category, tags, min_players, max_players, difficulty, is_free, solo_playable, korean_support');

  if (error || !games) {
    return NextResponse.json({ error: '게임 목록을 불러오지 못했어요.' }, { status: 500 });
  }

  // 서버에서 직접 필터링
  let filtered = [...games];

  for (const { question, answer } of answers) {
    if (answer === '아니오' || answer.includes('아니')) continue;
    if (question.includes('혼자') && answer.includes('혼자')) {
      filtered = filtered.filter(g => g.solo_playable !== false);
    }
    if (question.includes('무료') && answer.includes('무료')) {
      filtered = filtered.filter(g => g.is_free);
    }
    if (question.includes('한국어') && answer.includes('한국어')) {
      filtered = filtered.filter(g => g.korean_support && g.korean_support !== '한국어 없음');
    }
    if (question.includes('2인') || answer.includes('2인')) {
      filtered = filtered.filter(g => !g.min_players || g.min_players <= 2);
    }
    if (question.includes('난이도') && answer.includes('쉬')) {
      filtered = filtered.filter(g => g.difficulty === '쉬움' || g.difficulty === '보통');
    }
    if (question.includes('난이도') && answer.includes('어려')) {
      filtered = filtered.filter(g => g.difficulty === '어려움' || g.difficulty === '매우 어려움');
    }
  }

  // 후보가 3개 이하거나 질문 5개 이상이면 추천
  if (filtered.length <= 3 || answers.length >= 5) {
    const pick = filtered[Math.floor(Math.random() * Math.min(filtered.length, 5))];
    
    const prompt = `게임 "${pick.name}"을 추천하는 이유를 친근한 반말로 2문장 이내로 써줘. 텍스트만 출력.`;
    
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const reason = aiData.content?.[0]?.text?.trim() || '딱 맞는 게임이야!';

    return NextResponse.json({ done: true, game: pick, reason });
  }

  // 다음 질문 생성
  const gameList = filtered.slice(0, 50).map((g) =>
    `${g.name}|${(g.tags || []).slice(0, 3).join(',')}|${g.min_players}-${g.max_players}인|${g.difficulty}|무료:${g.is_free}|솔로:${g.solo_playable}|한국어:${g.korean_support}`
  ).join('\n');

  const askedQuestions = answers.map((a: any) => a.question).join(', ');

  const prompt = `너는 게임 추천 아키네이터야. 아래 ${filtered.length}개 후보 게임 중 가장 효과적으로 절반을 걸러낼 수 있는 질문 1개를 만들어.

후보 게임 (최대 50개):
${gameList}

이미 물어본 것: ${askedQuestions || '없음'}

규칙:
- 예/아니오 또는 2-3개 보기로
- 이미 물어본 것 제외
- 최대한 많은 게임을 걸러낼 수 있는 질문
- 짧고 명확하게

JSON만 출력:
{"question":"질문","options":["보기1","보기2"]}`;

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

  return NextResponse.json({
    question: parsed.question,
    options: parsed.options,
    remaining: filtered.length,
  });
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
}