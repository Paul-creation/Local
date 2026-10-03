// 담당: Paul(메인 배너·디자인)
'use client';

import { useState } from 'react';
import type { GameFilters } from '../../lib/useGameFilters';
import './quick-links.css';

const PLAYER_CHOICES: [string, string][] = [['1인', '혼자'], ['2인', '2명'], ['3-4인', '3~4명'], ['5인 이상', '5명+'], ['16명 이상', '16명+']];

// "뭐 하지" 상단 바로가기 — 인원으로 찾기 · 지금 할인 중 · 비교 만들기
// 필터는 주소(?p=·?sale=1)에도 담기므로 결과 화면을 그대로 공유할 수 있다
export default function QuickLinks({ filters }: { filters: GameFilters }) {
  const [pickPlayers, setPickPlayers] = useState(false);
  const show = (apply: () => void) => {
    apply();
    filters.setShowResults(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="quick-links">
      <div className="quick-links-row">
        <button type="button" className={`quick-chip${pickPlayers ? ' on' : ''}`} aria-expanded={pickPlayers} onClick={() => setPickPlayers((v) => !v)}>
          👥 인원으로 찾기
        </button>
        <button type="button" className="quick-chip" onClick={() => show(() => filters.setSaleOnly(true))}>
          🏷️ 지금 할인 중
        </button>
        <a href="/compare" className="quick-chip">⚖️ 비교 만들기</a>
      </div>
      {pickPlayers && (
        <div className="quick-links-row quick-players" role="group" aria-label="몇 명이서 할지">
          {PLAYER_CHOICES.map(([value, label]) => (
            <button key={value} type="button" className="quick-chip quick-chip-sm" onClick={() => show(() => filters.setSelectedPlayers(value))}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
