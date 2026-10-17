'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '../../lib/date';
import { MIN_REPORTERS, REPORT_KINDS, type ReportKind } from '../../lib/activityReports';

type Item = { gameId: string; key: string; kind: ReportKind; count: number; latest: string; name: string; label: string; now: 'confirmed' | 'unsure' | 'none' };

const NOW_LABEL = { confirmed: '지금 확정', unsure: '지금 확인 중', none: '지금 없음' } as const;
// 승인하면 일어나는 일을 버튼 옆에 미리 보여준다
const effect = (i: Item) =>
  i.kind === 'missing' ? '승인하면 확정 활동에 추가' : i.now === 'confirmed' ? '승인하면 확정에서 빼고 확인 중으로 이동' : '승인하면 확인 중에서 뺌';

// 관리자 "활동 제보" 탭: 게임·활동·종류별로 묶어 보여주고, 서로 다른 제보자 3명 이상이면 위. 승인해야만 games에 반영 (자동 반영 없음)
export default function ActivityReports() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/activity-reports');
    setItems(res.ok ? (await res.json()).items : []);
  };
  useEffect(() => { load(); }, []);

  const act = async (i: Item, action: 'approve' | 'dismiss') => {
    const res = await fetch('/api/admin/activity-reports', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: i.gameId, key: i.key, kind: i.kind, action }),
    });
    setMsg(res.ok ? (action === 'approve' ? '승인해서 반영했어요' : '무시로 표시했어요') : '실패했어요');
    setTimeout(() => setMsg(''), 2000);
    load();
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 14 }}>
        제보자 {MIN_REPORTERS}명 이상은 위로 올라와요. 승인을 눌러야만 게임에 반영돼요.
      </p>
      {msg && <p style={{ fontWeight: 700, marginBottom: 12 }}>{msg}</p>}
      {!items ? <p style={{ color: 'var(--text-dim)' }}>불러오는 중...</p> :
        items.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>처리할 활동 제보가 없어요</p> :
        items.map((i) => {
          const hot = i.count >= MIN_REPORTERS;
          return (
            <div key={`${i.gameId}:${i.key}:${i.kind}`} style={card}>
              <div style={{ fontSize: 15, marginBottom: 6 }}>
                <a href={`/games/${i.gameId}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)', fontWeight: 700 }}>{i.name}</a>
                {' · '}<b>{REPORT_KINDS[i.kind]}</b> {i.label}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 10 }}>
                제보자 {i.count}명{hot && <b style={{ color: 'var(--text)' }}> · {MIN_REPORTERS}명 이상</b>} · {NOW_LABEL[i.now]} · 최근 {formatDateTime(i.latest)}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => act(i, 'approve')} style={{ ...btn, background: 'var(--accent)', color: 'var(--accent-ink)' }}>승인</button>
                <button onClick={() => act(i, 'dismiss')} style={{ ...btn, background: 'var(--inset)', color: 'var(--text)' }}>무시</button>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{effect(i)}</span>
              </div>
            </div>
          );
        })}
    </div>
  );
}

const card: React.CSSProperties = { background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 10, border: '1px solid var(--border)' };
const btn: React.CSSProperties = { padding: '8px 16px', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 };
