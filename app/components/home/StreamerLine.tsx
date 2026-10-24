import type { StreamerRef } from '../../lib/streamerTheme';

// 카드의 스트리머 표시 — "방송 · 이름, 이름 +N" 보조 글자 한 줄 (모양: globals.css .sl-row)
// names: 이름만(목록의 스트리머 이름) 또는 {name, videoId, full}(스트리머 섹션 — 이름이 영상 링크). 이름은 앞 2명까지, 나머지는 "+N"
const SHOW = 2;

export default function StreamerLine({ names }: { names?: (string | StreamerRef)[] }) {
  const items = (names ?? []).map((n) => (typeof n === 'string' ? { name: n, videoId: null, full: false } : n));
  if (!items.length) return null;
  const rest = items.length - SHOW;
  return (
    <span className="sl-row" aria-label={`${items.map((i) => i.name).join(', ')} 플레이`}>
      <span className="sl-label">방송 · </span>
      {items.slice(0, SHOW).map((s, i) => (
        <span key={s.name}>
          {i > 0 && ', '}
          {s.videoId ? (
            <a className="sl-link" href={`https://www.youtube.com/watch?v=${s.videoId}`} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} 영상 보기(새 탭)${s.full ? ' (풀영상)' : ''}`}>{s.name}</a>
          ) : s.name}
        </span>
      ))}
      {rest > 0 && <span> +{rest}</span>}
    </span>
  );
}
