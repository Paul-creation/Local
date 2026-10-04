'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '../../lib/date';

type Item = { id: number; board?: string; post_id?: number; game_id?: string; games?: { name: string } | null; title?: string; body: string; nickname: string; report_count: number; created_at: string };
type Data = { posts: Item[]; comments: Item[]; reported: Item[]; gameComments: Item[] };
type Kind = 'post' | 'comment' | 'game_comment';

// 관리자: 신고로 숨겨진 글·댓글·게임 의견 복구·삭제 (공개 중인 신고 대상은 Moderation의 신고 목록에서)
export default function HiddenPosts() {
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/community');
    setData(res.ok ? await res.json() : null);
  };
  useEffect(() => { load(); }, []);

  const act = async (method: 'PATCH' | 'DELETE', type: Kind, id: number) => {
    if (method === 'DELETE' && !confirm('완전히 삭제할까요? 되돌릴 수 없어요.')) return;
    const res = await fetch('/api/admin/community', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }),
    });
    setMsg(res.ok ? (method === 'PATCH' ? '복구했어요 ✅' : '삭제했어요 🗑️') : '실패했어요 ❌');
    setTimeout(() => setMsg(''), 2000);
    load();
  };

  if (!data) return <p style={{ color: 'var(--text-dim)' }}>불러오는 중...</p>;

  const list = (title: string, items: Item[], type: Kind) => (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>{title} ({items.length})</h3>
      {items.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>없어요</p>}
      {items.map((it) => (
        <div key={it.id} style={card}>
          <div style={{ fontSize: 'var(--fs-sub)', color: 'var(--text-dim)', marginBottom: 6 }}>
            #{it.id} · {it.board || (it.game_id ? `${it.games?.name || '게임'} 의견` : `글 #${it.post_id}의 댓글`)} · {it.nickname} · 신고 {it.report_count}회 · {formatDateTime(it.created_at)}
          </div>
          {it.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{it.title}</div>}
          <div style={{ fontSize: 15, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto', color: '#333' }}>{it.body}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {type === 'game_comment' && <a href={`/games/${it.game_id}`} target="_blank" rel="noreferrer" style={{ ...btn, background: '#eee', color: '#16202b', textDecoration: 'none' }}>게임 보기</a>}
            {type === 'post' && <a href={`/community/post/${it.id}`} target="_blank" rel="noreferrer" style={{ ...btn, background: '#eee', color: '#16202b', textDecoration: 'none' }}>보기</a>}
            <button onClick={() => act('PATCH', type, it.id)} style={{ ...btn, background: '#16202b' }}>복구</button>
            <button onClick={() => act('DELETE', type, it.id)} style={{ ...btn, background: '#d64545' }}>삭제</button>
          </div>
        </div>
      ))}
    </section>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      {msg && <p style={{ fontWeight: 700, marginBottom: 12 }}>{msg}</p>}
      {list('숨겨진 글', data.posts, 'post')}
      {list('숨겨진 댓글', data.comments, 'comment')}
      {list('숨겨진 게임 의견', data.gameComments || [], 'game_comment')}
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, border: '1px solid #e5e3dc' };
const btn: React.CSSProperties = { padding: '8px 16px', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 };
