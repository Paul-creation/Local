import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 한글이 거의 없으면(영어 설명으로 판단) 재작성 대상
function needsRewrite(text) {
  if (!text) return false;
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  return koreanChars < text.length * 0.2;
}

async function main() {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name, category, tags, genres, description');

  if (error) {
    console.error('게임 목록 조회 실패:', error.message);
    return;
  }

  const targets = games.filter((g) => needsRewrite(g.description));
  console.log(`영어(또는 설명 없음) 게임 ${targets.length}개 발견, 재작성 시작\n`);

  for (const game of targets) {
    const prompt = `너는 게임 마케팅 카피라이터야. 아래 게임을 위한 한국어 소개문을 하나 써줘.

게임 이름: ${game.name}
카테고리: ${game.category || '미상'}
태그: ${(game.tags || []).join(', ')}
장르: ${(game.genres || []).join(', ')}
원문 설명(참고용, 영어일 수 있음): ${game.description || '없음'}

조건:
- Sea of Thieves 퀘스트 게시판에 붙어있는 글처럼, 상상력을 자극하고 유머러스한 톤
- 2~3문장, 너무 길지 않게
- 게임 실제 내용과 크게 벗어나지 않게
- 과장된 광고 문구체 말고, 재미있는 상황 묘사 위주로
- 결과는 소개문 텍스트만 출력, 따옴표나 부가 설명 붙이지 마`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`실패 (${game.name}):`, data.error?.message);
      continue;
    }

    const newDescription = data.content?.[0]?.text?.trim();

    const { error: updateError } = await supabase
      .from('games')
      .update({ description: newDescription })
      .eq('id', game.id);

    if (updateError) {
      console.error(`업데이트 실패 (${game.name}):`, updateError.message);
    } else {
      console.log(`✅ ${game.name}\n   → ${newDescription}\n`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`총 ${targets.length}개 처리 완료.`);
}

main();