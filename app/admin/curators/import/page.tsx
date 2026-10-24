'use client';

import { useCallback, useEffect, useState } from 'react';

type Curator = { id: string; handle: string; display_name: string };
type Found = { id: string; name: string; displayName: string | null; image: string | null; tier: 'exact' | 'normalized' | 'partial' };
type Steam = { appid: string; name: string; image: string | null; inDb: boolean };
type Item = { name: string; found: Found[]; steam: Steam[] };
type Pick = { kind: 'game'; id: string } | { kind: 'steam'; appid: string; name: string };
type Summary = { linked: number; alreadyLinked: number; queued: number; alreadyQueued: number; postType: string; notes: string[] };

const TIER_LABEL = { exact: '이름 일치', normalized: '비슷한 이름', partial: '일부 일치' } as const;
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--inset)', color: 'var(--text)', fontSize: 16, boxSizing: 'border-box', fontFamily: 'inherit' };
const label: React.CSSProperties = { display: 'block', fontSize: 14, color: 'var(--text-2)', marginBottom: 6, fontWeight: 700 };
const primary: React.CSSProperties = { padding: '12px 20px', background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 16 };

// 관리자: 인스타 캡션을 붙여넣어 게임 이름을 뽑고, 사이트의 게임에 연결하거나 추가 대기열에 넣는다
export default function CuratorImportPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [curators, setCurators] = useState<Curator[]>([]);

  const [curatorId, setCuratorId] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [postedAt, setPostedAt] = useState(today());
  const [postTitle, setPostTitle] = useState('');
  const [caption, setCaption] = useState('');

  const [busy, setBusy] = useState<'' | 'extract' | 'connect'>('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [picks, setPicks] = useState<(Pick | null)[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const applyCurators = useCallback(async (res: Response) => {
    if (res.status === 401) return setAuthed(false);
    const data = await res.json().catch(() => ({}));
    setCurators(data.items || []);
    setAuthed(true);
  }, []);
  useEffect(() => { fetch('/api/admin/curators').then(applyCurators); }, [applyCurators]);

  const login = async () => {
    const res = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) { setLoginError(''); applyCurators(await fetch('/api/admin/curators')); } else setLoginError('비밀번호가 틀렸어요.');
  };

  const extract = async () => {
    setError(''); setSummary(null); setItems(null);
    if (!caption.trim()) return setError('캡션을 붙여넣어 주세요.');
    setBusy('extract');
    const res = await fetch('/api/admin/curators/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption }) });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (res.status === 401) return setAuthed(false);
    if (data.title && !postTitle.trim()) setPostTitle(data.title);
    if (!res.ok || data.error) return setError(data.error || '실패했어요.');
    const list: Item[] = data.items;
    setItems(list);
    // 찾은 게임은 가장 잘 맞는 후보 하나를 기본 체크, 못 찾은 게임은 체크 없음
    setPicks(list.map((it) => (it.found[0] ? { kind: 'game', id: it.found[0].id } : null)));
  };

  const toggle = (i: number, p: Pick) =>
    setPicks((prev) => prev.map((cur, j) => {
      if (j !== i) return cur;
      const same = cur && cur.kind === p.kind && (cur.kind === 'game' ? cur.id === (p as { id: string }).id : cur.appid === (p as { appid: string }).appid);
      return same ? null : p;
    }));

  const chosen = picks.filter(Boolean) as Pick[];

  const connect = async () => {
    setError(''); setSummary(null);
    if (!curatorId) return setError('계정을 골라 주세요.');
    if (!postUrl.trim()) return setError('게시물 링크를 넣어 주세요.');
    setBusy('connect');
    const res = await fetch('/api/admin/curators/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        curatorId, postUrl, postedAt, postTitle,
        gameIds: chosen.filter((p) => p.kind === 'game').map((p) => (p as { id: string }).id),
        queue: chosen.filter((p) => p.kind === 'steam').map((p) => ({ appid: (p as { appid: string }).appid, name: (p as { name: string }).name })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (res.status === 401) return setAuthed(false);
    if (!res.ok) return setError(data.error || '실패했어요.');
    setSummary(data);
  };

  if (authed === null) return <main style={{ padding: 24, color: 'var(--text-muted)' }}>불러오는 중...</main>;

  if (!authed) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'var(--card)', padding: 32, borderRadius: 16, width: 320, maxWidth: '100%' }}>
          <h1 style={{ fontSize: 20, marginBottom: 20, fontWeight: 800 }}>어드민 로그인</h1>
          <input type="password" aria-label="비밀번호" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} style={{ ...input, marginBottom: 12 }} />
          {loginError && <p style={{ color: 'var(--sale)', fontSize: 15, marginBottom: 8 }}>{loginError}</p>}
          <button onClick={login} style={{ ...primary, width: '100%' }}>로그인</button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>인스타 게시물 연결</h1>
      <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20 }}>
        인스타 캡션을 복사해 붙여넣고 &quot;게임 찾기&quot;를 누르세요. 사이트에 없는 게임은 추가 대기열에 넣으면 다음 데일리에 가져와 같은 게시물에 연결해요.
      </p>

      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, display: 'grid', gap: 14 }}>
        <div>
          <label htmlFor="ci-curator" style={label}>계정</label>
          <select id="ci-curator" value={curatorId} onChange={(e) => setCuratorId(e.target.value)} style={input}>
            <option value="">계정 선택</option>
            {curators.map((c) => <option key={c.id} value={c.id}>{c.display_name} (@{c.handle})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ci-url" style={label}>게시물 링크</label>
          <input id="ci-url" type="url" inputMode="url" maxLength={300} placeholder="https://www.instagram.com/p/…" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} style={input} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div>
            <label htmlFor="ci-date" style={label}>게시 날짜</label>
            <input id="ci-date" type="date" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} style={input} />
          </div>
          <div>
            <label htmlFor="ci-title" style={label}>게시물 제목 (선택)</label>
            <input id="ci-title" type="text" maxLength={120} placeholder="비우면 캡션 첫 줄을 제안해요" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} style={input} />
          </div>
        </div>
        <div>
          <label htmlFor="ci-caption" style={label}>캡션 <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({caption.length}/6000)</span></label>
          <textarea id="ci-caption" rows={8} maxLength={6000} placeholder="인스타 캡션을 여기에 붙여넣기" value={caption} onChange={(e) => setCaption(e.target.value)} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
        </div>
        <button onClick={extract} disabled={busy !== ''} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>{busy === 'extract' ? '찾는 중...' : '게임 찾기'}</button>
      </section>

      {error && <p role="alert" style={{ color: 'var(--sale)', fontSize: 15, marginTop: 14 }}>{error}</p>}

      {items && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>찾은 이름 {items.length}개</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((it, i) => (
              <div key={`${it.name}-${i}`} style={{ background: 'var(--card)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 8 }}>
                  캡션 속 이름 <strong style={{ color: 'var(--text)' }}>{it.name}</strong>
                  {!it.found.length && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>· 사이트에 없어요{it.steam.length ? ' (스팀 후보)' : ' (스팀에서도 못 찾음)'}</span>}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {it.found.map((f) => {
                    const on = picks[i]?.kind === 'game' && (picks[i] as { id: string }).id === f.id;
                    return (
                      <label key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', minHeight: 44 }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(i, { kind: 'game', id: f.id })} style={{ width: 22, height: 22, flexShrink: 0 }} />
                        {f.image ? <img src={f.image} alt="" width={92} height={43} loading="lazy" style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'var(--inset)' }} /> : <span style={{ width: 92, height: 43, borderRadius: 6, background: 'var(--inset)', flexShrink: 0 }} />}
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 700, overflowWrap: 'anywhere' }}>{f.displayName || f.name}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{TIER_LABEL[f.tier]}</span>
                        </span>
                      </label>
                    );
                  })}
                  {it.steam.map((s) => {
                    const on = picks[i]?.kind === 'steam' && (picks[i] as { appid: string }).appid === s.appid;
                    return (
                      <label key={s.appid} style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', minHeight: 44 }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(i, { kind: 'steam', appid: s.appid, name: s.name })} style={{ width: 22, height: 22, flexShrink: 0 }} />
                        {s.image ? <img src={s.image} alt="" width={92} height={43} loading="lazy" style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'var(--inset)' }} /> : <span style={{ width: 92, height: 43, borderRadius: 6, background: 'var(--inset)', flexShrink: 0 }} />}
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 700, overflowWrap: 'anywhere' }}>{s.name}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            스팀 {s.appid} · {s.inDb ? '사이트에 이미 있어요 · 체크하면 바로 연결해요' : '체크하면 추가 대기열에 넣어요'}{' · '}
                            <a href={`https://store.steampowered.com/app/${s.appid}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-text)' }}>스팀에서 보기 ↗</a>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={connect} disabled={busy !== '' || !chosen.length} style={{ ...primary, opacity: busy || !chosen.length ? 0.5 : 1 }}>{busy === 'connect' ? '연결 중...' : '연결'}</button>
            <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
              체크 {chosen.length}개 (게임 {chosen.filter((p) => p.kind === 'game').length} · 대기열 {chosen.filter((p) => p.kind === 'steam').length}) → {chosen.length >= 2 ? '모음' : '단일'} 게시물
            </span>
          </div>
        </section>
      )}

      {summary && (
        <section role="status" style={{ marginTop: 20, background: 'var(--card)', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>결과</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 15 }}>
            <li>연결 {summary.linked}개{summary.alreadyLinked ? ` (이미 연결돼 건너뜀 ${summary.alreadyLinked}개)` : ''}</li>
            <li>추가 대기열 {summary.queued}개{summary.alreadyQueued ? ` (이미 대기 중이라 건너뜀 ${summary.alreadyQueued}개)` : ''}</li>
            <li>게시물 종류 {summary.postType === 'collection' ? '모음' : '단일'}</li>
            {summary.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
