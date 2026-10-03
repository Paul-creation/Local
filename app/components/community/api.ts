// 커뮤니티 쓰기 요청 공통 (브라우저 → 우리 서버 API. Supabase로 직접 쓰지 않음)
export async function send(url: string, method: string, body: unknown) {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data, error: res.ok ? '' : (data.error || '요청을 처리하지 못했어요.') };
  } catch {
    return { ok: false, data: {}, error: '네트워크 오류예요. 잠시 후 다시 시도해주세요.' };
  }
}

const NICK_KEY = 'community_nickname';
export const loadNickname = () => { try { return localStorage.getItem(NICK_KEY) || ''; } catch { return ''; } };
export const saveNickname = (v: string) => { try { localStorage.setItem(NICK_KEY, v); } catch {} };
