'use client';

import { useEffect, useState } from 'react';
import { formatDate, formatDateTime } from '../../lib/date';

type Channel = { channel_id: string; streamer_name: string; channel_title: string | null; handle: string | null; kind: string; enabled: boolean; uploads_checked_at: string | null };
type Video = { video_id: string; title: string; published_at: string; view_count: number | null; is_short: boolean; match_method: string; hidden: boolean; game_id: string; games: { name: string } | null };

const KIND_LABEL: Record<string, string> = { main: '본', vod: '다시보기', edit: '편집', game: '게임' };
const METHOD_LABEL: Record<string, string> = { title: '제목', description: '설명' };

// 관리자 스트리머 탭: 채널 켜기/끄기 · 채널을 고르면 연결된 영상 목록과 숨기기
export default function StreamerAdmin() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [picked, setPicked] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [msg, setMsg] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2000); };
  const loadChannels = async () => {
    const res = await fetch('/api/admin/streamers');
    const data = await res.json().catch(() => ({}));
    if (res.ok) setChannels(data.items);
    else { setChannels([]); setLoadError(data.error || '불러오지 못했어요'); }
  };
  const loadVideos = async (c: Channel) => {
    setVideos(null);
    const res = await fetch(`/api/admin/streamers?channel=${encodeURIComponent(c.channel_id)}`);
    setVideos(res.ok ? (await res.json()).items : []);
  };
  useEffect(() => { loadChannels(); }, []);

  const send = async (body: object, done: string) => {
    const res = await fetch('/api/admin/streamers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    flash(res.ok ? done : '실패했어요');
    return res.ok;
  };
  const toggleChannel = async (c: Channel) => {
    if (await send({ channel_id: c.channel_id, enabled: !c.enabled }, c.enabled ? `${c.channel_title} 채널을 껐어요` : `${c.channel_title} 채널을 켰어요`)) loadChannels();
  };
  const toggleVideo = async (v: Video) => {
    if (await send({ video_id: v.video_id, hidden: !v.hidden }, v.hidden ? '영상을 다시 보이게 했어요' : '영상을 숨겼어요') && picked) loadVideos(picked);
  };

  if (!channels) return <p style={{ color: 'var(--text-dim)' }}>불러오는 중...</p>;

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: 380, maxWidth: '100%' }}>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12 }}>
          끈 채널의 영상은 사이트에 안 나오고, 새 영상도 모으지 않아요.
        </p>
        {loadError && <p style={{ color: 'var(--sale)', fontSize: 14, marginBottom: 12 }}>{loadError}</p>}
        {msg && <p style={{ fontWeight: 700, marginBottom: 12 }}>{msg}</p>}
        {channels.map((c) => (
          <div key={c.channel_id} style={{ ...card, opacity: c.enabled ? 1 : 0.55, outline: picked?.channel_id === c.channel_id ? '2px solid var(--accent)' : 'none' }}>
            <button onClick={() => { setPicked(c); loadVideos(c); }} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{c.streamer_name} · {c.channel_title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {KIND_LABEL[c.kind] || c.kind} · {c.handle} · {c.uploads_checked_at ? `확인 ${formatDateTime(c.uploads_checked_at)}` : '아직 확인 안 함'}
              </div>
            </button>
            <button onClick={() => toggleChannel(c)} style={{ ...btn, background: c.enabled ? 'var(--accent)' : 'var(--inset)', color: c.enabled ? 'var(--accent-ink)' : 'var(--text)' }}>
              {c.enabled ? '켜짐' : '꺼짐'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 300 }}>
        {!picked ? <p style={{ color: 'var(--text-dim)' }}>왼쪽에서 채널을 고르면 연결된 영상이 나와요</p> : (
          <>
            <h3 style={{ fontWeight: 800, marginBottom: 12 }}>{picked.channel_title} 영상 {videos ? `(${videos.length})` : ''}</h3>
            {!videos ? <p style={{ color: 'var(--text-dim)' }}>불러오는 중...</p> :
              videos.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>연결된 영상이 없어요</p> :
              videos.map((v) => (
                <div key={v.video_id} style={{ ...card, opacity: v.hidden ? 0.55 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--text)' }}>{v.title}</a>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
                      게임 <a href={`/games/${v.game_id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>{v.games?.name ?? '(없는 게임)'}</a>
                      {' '}· {METHOD_LABEL[v.match_method] || v.match_method}에서 찾음 · {formatDate(v.published_at)}
                      {v.view_count != null && ` · 조회수 ${v.view_count.toLocaleString('ko-KR')}`}
                      {v.is_short && ' · 쇼츠'}
                      {v.hidden && <b style={{ color: 'var(--sale)' }}> · 숨김 중</b>}
                    </div>
                  </div>
                  <button onClick={() => toggleVideo(v)} style={{ ...btn, background: 'var(--inset)', color: 'var(--text)' }}>
                    {v.hidden ? '다시 보이기' : '숨기기'}
                  </button>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', borderRadius: 12, padding: 14, marginBottom: 8, border: '1px solid var(--border)' };
const btn: React.CSSProperties = { padding: '8px 14px', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14, flexShrink: 0 };
