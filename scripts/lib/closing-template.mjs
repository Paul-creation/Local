// scripts/lib/closing-template.mjs — --reel-trend 릴스 마지막 멘트 고정 템플릿
// 출시 예정(coming_soon) → Trash Island 템플릿, 출시된 게임 → CRACK 템플릿. 게임 이름 자리({name})만 바뀐다.
// 음성 설정: coming_soon은 --reel-trend 기본 음성 설정(0.45/0.8/0.15/1.2)으로 통일, released(crack)는 그 문장을 만들 때 쓴 값(copy/crack-trend-v2.json)
// copy에 마지막 문장이 적혀 있어도 템플릿이 우선한다(copy.closing:false면 건너뜀. narration.perSentence:false인 옛 copy도 건너뜀).
export const CLOSING = {
  coming_soon: {
    id: 'trash-island',
    sentences: ['이름은 {name}입니다.', '저장해두고, 출시 후 플레이해보세요!'],
    chunks: ['이름은', '[{name}]입니다', '저장해두고', '출시 후', '플레이해보세요'],
    tts: { 2: '저장해두고, 출시 후 플레이 해보세요.' }, // TTS 입력(문장 번호는 템플릿 안 순서 1부터). 자막은 위 sentences 그대로 — "플레이해보세요!"를 그대로 읽히면 "플레에에이이"처럼 늘어져서 띄어 쓰고 마침표로
    voice: { stability: 0.45, similarity_boost: 0.8, style: 0.15, speed: 1.2 }, // 다른 문장(--reel-trend 기본 음성 설정)과 같은 값
  },
  released: {
    id: 'crack',
    sentences: ['게임 이름은 {name}입니다.', '근데 진짜, {hook}'], // {hook} = copy.closingHook(게임마다 다름, "~?" 형식 — 앞의 "근데 진짜, "는 고정)
    chunks: ['게임 이름은', '[{name}]입니다', '근데 진짜', '{hook}'], // {hook} 자리는 closingHookChunks(copy.closingHookChunks가 있으면 그것)로 풀린다
    voice: { stability: 0.5, similarity_boost: 0.8, style: 0.25, speed: 1.1 },
  },
};

const splitSentences = (text) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean); // narration-sentences.mjs와 같은 규칙
const plain = (s) => String(s).replace(/[\s.,!?~…[\]]/g, '');

// 출시 상태: games.release_status가 있으면 그것, games에 없으면 Steam appdetails의 coming_soon(soon)
export async function releaseState(appid, soon, { fetchFn = fetch, env = process.env } = {}) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const r = await fetchFn(`${url}/rest/v1/games?select=release_status&steam_appid=eq.${encodeURIComponent(appid)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      const rows = r.ok ? await r.json() : [];
      const st = rows[0]?.release_status;
      if (st === 'coming_soon' || st === 'released') return { state: st, source: 'games' };
    } catch { /* DB를 못 읽으면 appdetails 값 */ }
  }
  return { state: soon ? 'coming_soon' : 'released', source: 'steam appdetails' };
}

// 출시작 둘째 문장 자막 덩어리: 훅을 어절로 나눠 뒤 두 어절을 [핵심]으로, 앞은 한 덩어리로(예: "이 알 안에" + "[뭐가 들었을까요]"). 어절이 둘 이하면 통째로 [핵심]
export function closingHookChunks(hook) {
  const w = String(hook).replace(/[?？]+$/, '').trim().split(/\s+/).filter(Boolean);
  if (w.length <= 2) return [`[${w.join(' ')}]`];
  return [w.slice(0, -2).join(' '), `[${w.slice(-2).join(' ')}]`];
}

// copy를 제자리에서 고친다. 마지막 멘트 = "이름은"이 들어 있는 마지막 문장부터 끝까지(없으면 끝에 덧붙임)
export function applyClosing(copy, { state, name }) {
  const n = copy.narration;
  if (copy.closing === false) return { skipped: 'copy.closing:false' };
  if (!n || n.perSentence === false) return { skipped: '문장 단위 생성이 아닌 copy' };
  const tpl = CLOSING[state];
  if (!tpl) throw new Error(`closing: 알 수 없는 출시 상태 ${state}`);
  let hook = '';
  if (state === 'released') {
    hook = String(copy.closingHook ?? '').trim();
    if (!/\S.*\?$/.test(hook)) throw new Error('closing: 출시작은 copy.closingHook이 필요해요 — 둘째 문장 "근데 진짜, ~?"의 "~?" 부분을 적으세요(예: "이 알 안에 뭐가 들었을까요?")');
  }
  const fill = (s) => s.replaceAll('{name}', name).replaceAll('{hook}', hook);
  const sents = splitSentences(n.text);
  let k = sents.length;
  for (let i = sents.length - 1; i >= 0; i--) if (/이름은/.test(sents[i])) { k = i; break; }
  const oldLetters = plain(sents.slice(k).join(''));
  const added = tpl.sentences.map(fill);
  n.text = [...sents.slice(0, k), ...added].join(' ');
  const ss = Object.fromEntries(Object.entries(n.sentenceSettings ?? {}).filter(([i]) => Number(i) <= k)); // 문장 번호는 1부터
  added.forEach((_, j) => { ss[String(k + 1 + j)] = { ...tpl.voice }; });
  n.sentenceSettings = ss;
  if (n.tts) n.tts = Object.fromEntries(Object.entries(n.tts).filter(([i]) => Number(i) <= k));
  if (tpl.tts) n.tts = { ...(n.tts ?? {}), ...Object.fromEntries(Object.entries(tpl.tts).map(([j, t]) => [String(k + Number(j)), fill(t)])) };
  if (copy.chunks) { // 옛 마지막 멘트 글자 수만큼 뒤에서 덜어내고 템플릿 덩어리를 붙인다
    let left = oldLetters.length, cut = copy.chunks.length;
    while (left > 0 && cut > 0) { cut--; left -= plain(copy.chunks[cut]).length; }
    if (left !== 0) throw new Error('closing: copy.chunks의 끝이 마지막 멘트 글자 수와 안 맞아요 — chunks 끝을 확인하세요');
    const hookChunks = copy.closingHookChunks ?? (hook ? closingHookChunks(hook) : []);
    copy.chunks = [...copy.chunks.slice(0, cut), ...tpl.chunks.flatMap((c) => (c === '{hook}' ? hookChunks : [fill(c)]))];
  }
  copy.cardFrom = tpl.chunks[0].replace(/[[\]]/g, ''); // 정보 카드는 마지막 멘트 첫 덩어리에서 시작
  return { template: tpl.id, state, sentences: added, voice: tpl.voice };
}
