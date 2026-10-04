'use client';

import { useState, useEffect } from 'react';
import Moderation, { type ModTab } from '../components/admin/Moderation';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [games, setGames] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [tab, setTab] = useState<'games' | 'community'>('games');
  const [modTab, setModTab] = useState<ModTab>('reports');

  // 디스코드 알림 링크(/admin?tab=feedback 등)로 들어오면 운영 탭의 해당 목록부터
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'reports' || t === 'hidden' || t === 'feedback') { setTab('community'); setModTab(t); }
  }, []);

  const login = async () => {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      loadGames();
    } else {
      setError('비밀번호가 틀렸어요.');
    }
  };

  const loadGames = async () => {
    const res = await fetch('/api/admin/games');
    const data = await res.json();
    setGames(data);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/admin/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        tags: selected.tags,
        difficulty: selected.difficulty,
        min_players: selected.min_players,
        max_players: selected.max_players,
        recommended_players: selected.recommended_players,
        solo_playable: selected.solo_playable,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg('저장됐어요! ✅');
      setTimeout(() => setSaveMsg(''), 2000);
      loadGames();
    } else {
      setSaveMsg('저장 실패 ❌');
    }
  };

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f2ec' }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: 320 }}>
          <h2 style={{ marginBottom: 20, fontWeight: 800 }}>어드민 로그인</h2>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 12, fontSize: 15, boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: '#d64545', fontSize: 15, marginBottom: 8 }}>{error}</p>}
          <button
            onClick={login}
            style={{ width: '100%', padding: '10px 0', background: '#16202b', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  const tabBar = (
    <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e3dc' }}>
      {([['games', '게임 편집'], ['community', '신고·숨김·의견함']] as const).map(([k, label]) => (
        <button
          key={k}
          onClick={() => setTab(k)}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, background: tab === k ? '#16202b' : '#f0efe9', color: tab === k ? '#fff' : '#16202b' }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (tab === 'community') {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f2ec' }}>
        {tabBar}
        <div style={{ padding: 32 }}><Moderation initial={modTab} /></div>
      </div>
    );
  }

  return (
    <>
    {tabBar}
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f2ec' }}>
      {/* 게임 목록 */}
      <div style={{ width: 280, background: '#fff', borderRight: '1px solid #e5e3dc', overflowY: 'auto', padding: 16 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: 16 }}>게임 목록 ({games.length})</h3>
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => { setSelected({ ...g }); setSaveMsg(''); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 12px', borderRadius: 8, border: 'none',
              background: selected?.id === g.id ? '#f0f9f8' : 'transparent',
              cursor: 'pointer', fontSize: 15, fontWeight: selected?.id === g.id ? 700 : 400,
              color: '#16202b', marginBottom: 2,
            }}
          >
            {g.name}
            {g.hidden && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fef3c7', borderRadius: 4, padding: '1px 6px' }}>숨김</span>}
          </button>
        ))}
      </div>

      {/* 편집 패널 */}
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {!selected ? (
          <p style={{ color: 'var(--text-dim)' }}>왼쪽에서 게임을 선택하세요</p>
        ) : (
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ fontWeight: 800, marginBottom: 24 }}>{selected.name}</h2>
            {selected.hidden && (
              <p style={{ margin: '-12px 0 20px', padding: '10px 12px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontSize: 14 }}>
                숨긴 게임이에요. 사이트 화면·검색·시리즈·sitemap에 나오지 않아요.
                {selected.merged_into && (
                  <> 상세 주소로 들어오면 <a href={`/games/${selected.merged_into}`} target="_blank" rel="noreferrer">{games.find((x) => x.id === selected.merged_into)?.name ?? '남긴 게임'}</a>(으)로 이동해요.</>
                )}
              </p>
            )}

            {/* 배지 — 인원·협동/대전 칸에서 자동 계산 (저장하면 다시 계산됨) */}
            <label style={labelStyle}>배지 (자동)</label>
            <input style={{ ...inputStyle, color: 'var(--text-dim)' }} value={selected.category || '(없음)'} readOnly />

            {/* 난이도 */}
            <label style={labelStyle}>난이도</label>
            <select
              style={inputStyle}
              value={selected.difficulty || ''}
              onChange={(e) => setSelected({ ...selected, difficulty: e.target.value })}
            >
              <option value="">선택</option>
              <option value="쉬움">쉬움</option>
              <option value="보통">보통</option>
              <option value="어려움">어려움</option>
              <option value="매우 어려움">매우 어려움</option>
            </select>

            {/* 인원수 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>최소 인원</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={selected.min_players || ''}
                  onChange={(e) => setSelected({ ...selected, min_players: Number(e.target.value) })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>최대 인원</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={selected.max_players || ''}
                  onChange={(e) => setSelected({ ...selected, max_players: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* 추천 인원 */}
            <label style={labelStyle}>추천 인원</label>
            <input
              style={inputStyle}
              placeholder="예: 2-4인, 팀플"
              value={selected.recommended_players || ''}
              onChange={(e) => setSelected({ ...selected, recommended_players: e.target.value })}
            />

            {/* 솔로 가능 */}
            <label style={labelStyle}>솔로 플레이</label>
            <select
              style={inputStyle}
              value={selected.solo_playable === true ? 'true' : selected.solo_playable === false ? 'false' : ''}
              onChange={(e) => setSelected({ ...selected, solo_playable: e.target.value === 'true' })}
            >
              <option value="">선택</option>
              <option value="true">혼자도 가능</option>
              <option value="false">멀티 필수</option>
            </select>

            {/* 태그 */}
            <label style={labelStyle}>태그 (쉼표로 구분)</label>
            <textarea
              style={{ ...inputStyle, height: 80, resize: 'vertical' }}
              value={(selected.tags || []).join(', ')}
              onChange={(e) => setSelected({
                ...selected,
                tags: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean)
              })}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '12px 28px', background: '#16202b', color: '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15,
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              {saveMsg && <span style={{ fontSize: 15, fontWeight: 600 }}>{saveMsg}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 15, fontWeight: 700,
  color: '#16202b', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  borderRadius: 8, border: '1px solid #ddd',
  fontSize: 15, marginBottom: 16,
  boxSizing: 'border-box', background: '#fff',
};