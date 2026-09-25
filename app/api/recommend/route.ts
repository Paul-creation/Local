import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function filterGames(games: any[], answers: { question: string; answer: string }[]) {
  let filtered = [...games];

  for (const { question, answer } of answers) {
    const q = question.toLowerCase();
    const a = answer.toLowerCase();

    // 플레이 방식
    if (q.includes('어떻게 플레이')) {
      if (a.includes('혼자')) filtered = filtered.filter(g => g.solo_playable !== false);
      else if (a.includes('친구')) filtered = filtered.filter(g => g.max_players >= 2);
      continue;
    }

    // 무료
    if (q.includes('무료') || q.includes('돈')) {
      if (a.includes('무료') || a.includes('공짜') || a.includes('응') || a.includes('예')) {
        filtered = filtered.filter(g => g.is_free);
      } else if (a.includes('아니') || a.includes('유료') || a.includes('상관')) {
        filtered = filtered.filter(g => !g.is_free);
      }
      continue;
    }

    // 한국어
    if (q.includes('한국어')) {
      if (a.includes('필요') || a.includes('응') || a.includes('예') || a.includes('있')) {
        filtered = filtered.filter(g => g.korean_support && g.korean_support !== '한국어 없음');
      }
      continue;
    }

    // 난이도
    if (q.includes('난이도') || q.includes('어렵') || q.includes('쉽')) {
      if (a.includes('쉬') || a.includes('가볍') || a.includes('편하')) {
        filtered = filtered.filter(g => g.difficulty === '쉬움' || g.difficulty === '보통');
      } else if (a.includes('어려') || a.includes('도전') || a.includes('빡')) {
        filtered = filtered.filter(g => g.difficulty === '어려움' || g.difficulty === '매우 어려움');
      }
      continue;
    }

    // 인원수
    if (q.includes('인원') || q.includes('몇 명') || q.includes('명이') || q.includes('몇명')) {
      if (a.includes('2인') || a.includes('2명') || a.includes('둘')) {
        filtered = filtered.filter(g => g.min_players <= 2 && g.max_players >= 2);
      } else if (a.includes('3') || a.includes('4')) {
        filtered = filtered.filter(g => g.max_players >= 3);
      } else if (a.includes('5') || a.includes('대규모')) {
        filtered = filtered.filter(g => g.max_players >= 5);
      }
      continue;
    }

    // 공포
    if (q.includes('공포') || q.includes('호러') || q.includes('무서')) {
      if (a.includes('좋아') || a.includes('응') || a.includes('예') || a.includes('ㅇ')) {
        filtered = filtered.filter(g => g.tags?.some((t: string) => ['호러', 'Survival Horror', '심리 공포'].includes(t)));
      } else if (a.includes('싫') || a.includes('아니') || a.includes('별로')) {
        filtered = filtered.filter(g => !g.tags?.some((t: string) => ['호러', 'Survival Horror', '심리 공포'].includes(t)));
      }
      continue;
    }

    // 장르
    if (q.includes('장르') || q.includes('게임 종류') || q.includes('어떤 게임')) {
      if (a.includes('슈팅') || a.includes('fps')) {
        filtered = filtered.filter(g => g.tags?.some((t: string) => ['FPS', '슈팅'].includes(t)));
      } else if (a.includes('rpg') || a.includes('역할')) {
        filtered = filtered.filter(g => g.tags?.some((t: string) => ['RPG', '액션 RPG', 'MMORPG'].includes(t)));
      } else if (a.includes('생존') || a.includes('서바이벌')) {
        filtered = filtered.filter(g => g.tags?.includes('생존'));
      } else if (a.includes('퍼즐')) {
        filtered = filtered.filter(g => g.tags?.includes('퍼즐'));
      } else if (a.includes('전략')) {
        filtered = filtered.filter(g => g.tags?.some((t: string) => ['전략', 'Turn-Based Strategy'].includes(t)));
      }
      continue;
    }

    // 오픈월드
    if (q.includes('오픈월드') || q.includes('자유롭게')) {
      if (a.includes('좋아') || a.includes('응') || a.includes('예')) {
        filtered = filtered.filter(g => g.tags?.includes('오픈월드'));
      } else if (a.includes('아니') || a.includes('별로')) {
        filtered = filtered.filter(g => !g.tags?.includes('오픈월드'));
      }
      continue;
    }

    // 경쟁/협동
    if (q.includes('경쟁') || q.includes('협동') || q.includes('같이')) {
      if (a.includes('협동') || a.includes('같이') || a.includes('협력')) {
        filtered = filtered.filter(g => g.category === '협동' || g.tags?.includes('온라인 협동'));
      } else if (a.includes('경쟁') || a.includes('pvp')) {
        filtered = filtered.filter(g => g.tags?.some((t: string) => ['경쟁', 'e스포츠', '배틀로얄'].includes(t)));
      }
      continue;
    }
  }

  return filtered;
}

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

  const filtered = filterGames(games, answers);

  // 첫 질문은 고정
  if (answers.length === 0) {
    return NextResponse.json({
      question: '어떻게 플레이하고 싶어?',
      options: ['혼자 즐기고 싶어', '친구랑 같이 하고 싶어', '둘 다 괜찮아'],
      remaining: filtered.length,
    });
  }

  // 후보 3개 이하 or 질문 5개 이상이면 추천
  if (filtered.length <= 3 || answers.length >= 5) {
    const candidates = filtered.slice(0, 5);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];

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
  const answersText = answers.map((a: any) => `Q: ${a.question} → A: ${a.answer}`).join('\n');

  const prompt = `너는 게임 추천 아키네이터야. 아래 ${filtered.length}개 후보 게임 중 가장 효과적으로 절반을 걸러낼 수 있는 질문 1개를 만들어.

후보 게임:
${gameList}

지금까지 답변:
${answersText}

이미 물어본 것: ${askedQuestions}

규칙:
- 이전 답변과 모순되는 질문 절대 금지 (혼자 한다고 했으면 인원수 묻지 마)
- 이전 답변과 자연스럽게 이어지는 질문
- 보기는 자연스러운 한국어로 (2-3개)
- 짧고 명확하게
- 게임 특성(태그, 난이도, 장르, 무료여부, 한국어지원, 공포여부, 오픈월드 등) 골고루 활용
- 답변에 따라 서버에서 필터링 가능한 질문 위주로
- 질문과 보기 모두 반말로 (예: "좋아해?", "응 좋아", "별로야")
- 존댓말 절대 금지

JSON만 출력:
{"question":"질문","options":["보기1","보기2","보기3"]}`;

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