// 담당: Paul(메인 배너·디자인)
'use client';

import { useState } from 'react';
import type { GameFilters } from '../../lib/useGameFilters';
import { PLAYERS_MAX, type Range } from '../../lib/rangeFilter';
import './quick-links.css';

// 인원 범위 (app/lib/rangeFilter): 2명·3~4명은 그 인원으로 할 수 있는 게임, 5명+·16명+는 그만큼 모일 수 있는 게임
// 혼자는 범위가 아니라 1인 전용(최대 인원 1)
const PLAYER_CHOICES: [Range, string][] = [[[2, 2], '2명'], [[3, 4], '3~4명'], [[0, 5], '5명+'], [[0, PLAYERS_MAX], '16명+']];

// "뭐 하지" 상단 바로가기 — 인원으로 찾기 · 지금 할인 중 · 비교 만들기
// 필터는 주소(?players=·?sale=1)에도 담기므로 결과 화면을 그대로 공유할 수 있다
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
          <button type="button" className="quick-chip quick-chip-sm" onClick={() => show(() => filters.setSoloOnly(true))}>
            혼자
          </button>
          {PLAYER_CHOICES.map(([value, label]) => (
            <button key={label} type="button" className="quick-chip quick-chip-sm" onClick={() => show(() => filters.setPlayersRange(value))}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
