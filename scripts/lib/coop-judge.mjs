// scripts/lib/coop-judge.mjs
// 규칙을 통과한 후보 영상(제목 + 설명 앞부분)을 Haiku에 한 번에 보내서 "이 게임을 여러 명이 같이 플레이하는 영상"만 번호로 받는다
// 게임당 1번 호출 (후보 최대 15개, 설명 포함 약 $0.003)
import { koNames, DESC_HEAD } from './coop-targets.mjs';

export const JUDGE_MAX = 15;

export async function judgeCoopVideos(game, candidates) {
  const list = candidates.slice(0, JUDGE_MAX);
  if (!list.length) return { keep: [], usage: null };
  const names = [game.name, ...koNames(game.search_name_ko)].join(' / ');
  const year = /^\d{4}/.exec(String(game.release_date || ''))?.[0];
  const info = [year ? `출시 ${year}년` : '', game.developer ? `개발사 ${game.developer}` : ''].filter(Boolean).join(', ');
  const prompt = `게임: ${names}${info ? ` (${info})` : ''}

아래는 이 게임을 검색해서 나온 유튜브 영상의 제목과 설명 앞부분이야. "이 게임을 여러 명이 같이 플레이하는 영상"(합방, 친구들과 멀티, 협동 플레이)만 골라줘.
제목에 게임 이름이 없어도 설명이나 내용으로 이 게임을 여럿이 하는 영상이 확실하면 골라도 돼.
제외할 것:
- 다른 게임 영상, 게임과 상관없는 영상 (이름만 비슷한 사람·회사·물건 포함)
- 혼자 플레이하는 영상
- 이름이 같거나 비슷해도 위 출시 연도·개발사의 이 작품이 아닌 영상: 리메이크·리마스터, 속편·전작, 로블록스나 모바일 게임 등
  (예: The Forest를 찾는데 Sons Of The Forest / 선즈 오브 더 포레스트, 로블록스 "99 Nights in the Forest" / 99나이트 인 더 포레스트, ARK: Survival Evolved를 찾는데 아크 어센디드)
- 리뷰, 추천, 공략, 정보 영상
확실하지 않으면 제외해.

영상 목록:
${list.map((v, i) => {
  const desc = String(v.description || '').replace(/\s+/g, ' ').trim().slice(0, DESC_HEAD);
  return `${i + 1}. 제목: ${v.title} (채널: ${v.channel_title || '?'})${desc ? `\n   설명: ${desc}` : ''}`;
}).join('\n')}

JSON으로만 답해. 설명이나 코드블록은 쓰지 마. 고를 게 없으면 빈 배열.
{"keep": [1, 3]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`Haiku 오류 HTTP ${res.status} ${json.error?.message || ''}`.trim());
  const text = (json.content || []).map((c) => c.text || '').join('');
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const keep = (parsed.keep || []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= list.length);
  return { keep: [...new Set(keep)].map((n) => list[n - 1]), usage: json.usage || null };
}

// Haiku 4.5 가격: 입력 $1, 출력 $5 (100만 토큰당)
export const haikuCost = (u) => (u ? (u.input_tokens || 0) / 1e6 + (u.output_tokens || 0) * 5 / 1e6 : 0);
