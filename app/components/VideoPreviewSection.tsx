'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import YouTubeLite from './YouTubeLite';
import { formatDate } from '../lib/date';
import type { VideoItem } from '../lib/videoList';

// 상세 주소 끝에 붙는 해시 — 메인 "스트리머가 플레이한 게임" 카드가 이 섹션으로 바로 보냄
const VIDEOS_ANCHOR = 'streamer-videos';

// 12345 → 1.2만, 123456 → 12만, 123456789 → 1.2억
function formatViews(n: number) {
  if (n >= 1e8) return `${+(n / 1e8).toFixed(1)}억`;
  if (n >= 1e5) return `${Math.floor(n / 1e4)}만`;
  if (n >= 1e4) return `${+(n / 1e4).toFixed(1)}만`;
  return n.toLocaleString('ko-KR');
}

const metaOf = (v: VideoItem) => [v.view_count ? `조회수 ${formatViews(v.view_count)}` : '', formatDate(v.published_at)].filter(Boolean).join(' · ');

// 목록의 작은 썸네일 (16:9, 320×180, 바로 받음 — 삭제된 영상이 페이지를 열자마자 목록에서 빠지게). 삭제된 영상은 유튜브가 120×90 회색 이미지를 주므로 그때 부모에게 알려 목록에서 뺌
function RailThumb({ id, onBroken }: { id: string; onBroken: () => void }) {
  const ref = useRef<HTMLImageElement>(null);
  const check = (img: HTMLImageElement) => {
    if (img.naturalWidth <= 120) onBroken();
  };
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) check(img); // 서버에서 그린 이미지가 hydration 전에 다 받아진 경우
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="eager" decoding="async" onLoad={(e) => check(e.currentTarget)} onError={onBroken} />
  );
}

// 썸네일 목록의 좌우 이동 — 보이는 폭의 약 80%씩 스크롤. 맨 끝이거나 목록이 다 보이면 그쪽 버튼 숨김 (스크롤 이벤트 + ResizeObserver로 갱신)
// 버튼 자체는 CSS가 마우스 기기(hover: hover)에서만 보여줌. 터치 기기는 스와이프만
function useRailScroll(count: number) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const prev = el.scrollLeft > 1;
    const next = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge((e) => (e.prev === prev && e.next === next ? e : { prev, next }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [update, count]);
  const move = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };
  return [ref, edge, move] as const;
}

// 상세 페이지 "영상으로 미리 보기" — 섹션 폭 전체 16:9 메인 플레이어 1개 + 아래 작은 썸네일 목록
// 처음엔 목록 첫 영상이 썸네일 상태로 떠 있고, 목록의 썸네일을 누르면 메인이 그 영상으로 바뀌어 바로 재생됨 (새 페이지 이동 없음)
// 목록 순서·자르기는 lib/videoList, 출처 문구(label)도 거기서 만듦
export default function VideoPreviewSection({ videos, streamers }: { videos: VideoItem[]; streamers: ReactNode }) /* streamers: 채널 링크 칩 (없으면 null) */ {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picks, setPicks] = useState(0); // 썸네일을 누른 횟수 — 0이면 아직 사용자가 고른 적 없음(자동 재생 안 함). 같은 영상을 다시 눌러도 플레이어를 새로 그려 재생
  const markBroken = (id: string) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const list = videos.filter((v) => !broken.has(v.video_id));
  const [railRef, railEdge, moveRail] = useRailScroll(list.length);
  if (!list.length && !streamers) return null;
  const current = list.find((v) => v.video_id === selectedId) ?? list[0];

  return (
    <section className="detail-card" id={VIDEOS_ANCHOR}>
      <h3 className="detail-card-title">영상으로 미리 보기</h3>

      {current && (
        <>
          <div className="video-stage">
            <YouTubeLite
              key={`${current.video_id}:${picks}`}
              url={`https://www.youtube.com/embed/${current.video_id}`}
              title={current.title}
              wide
              autoPlay={picks > 0}
              onBroken={() => markBroken(current.video_id)}
            />
          </div>
          <div className="video-stage-info">
            <div className="video-stage-title">{current.title}</div>
            <div className="video-stage-sub">
              <span className="chip is-static">{current.label}</span>
              {metaOf(current) && <span className="coop-video-meta">{metaOf(current)}</span>}
            </div>
          </div>

          {list.length > 1 && (
            <div className="video-rail-wrap">
              {railEdge.prev && <button type="button" className="video-rail-arrow is-prev" aria-label="이전 영상" onClick={() => moveRail(-1)}>‹</button>}
              {railEdge.next && <button type="button" className="video-rail-arrow is-next" aria-label="다음 영상" onClick={() => moveRail(1)}>›</button>}
              <ul className="video-rail" aria-label="다른 영상" ref={railRef}>
                {list.map((v) => (
                  <li key={v.video_id} className="video-rail-item">
                    <button
                      type="button"
                      className="video-rail-btn"
                      aria-current={v.video_id === current.video_id ? 'true' : undefined}
                      onClick={(e) => {
                        setSelectedId(v.video_id);
                        setPicks((n) => n + 1);
                        // 가려진 카드면 목록 안에서만 움직여 보이게 (페이지가 세로로 튀지 않게 block도 nearest)
                        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                        e.currentTarget.closest('li')?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
                      }}
                    >
                      <span className="video-rail-thumb"><RailThumb id={v.video_id} onBroken={() => markBroken(v.video_id)} /></span>
                      <span className="coop-video-title">{v.title}</span>
                      <span className="chip is-static video-rail-chip">{v.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="video-source">영상 출처: YouTube</p>
        </>
      )}

      {streamers && (
        <div className={current ? 'streamer-channels has-videos' : 'streamer-channels'}>
          <h4 className="streamer-sub">이 게임을 플레이한 채널</h4>
          {streamers}
        </div>
      )}
    </section>
  );
}
