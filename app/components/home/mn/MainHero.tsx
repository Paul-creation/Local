// 담당: Paul(메인 배너·디자인)
'use client';

import SearchPanel from '../../search/SearchPanel';
import AbSearch from '../ab/AbSearch';
import MemberHeadline from './MemberHeadline';
import GameLink from '../../GameLink';
import type { GameFilters } from '../../../lib/useGameFilters';
import type { HeroFeatured } from '../../../lib/homeMain';

// 메인 상단
// 방문자: 높이 640px 히어로 — 이번 주 대표 게임의 Steam 라이브러리 히어로 이미지 1장(와이드) 위에 좌우·위아래 그라데이션 마스크 → 제목 + 한 줄 설명 → 3칸 검색창. 오른쪽 가장자리에 세로 글씨 "게임 이름 (출시연도)"(누르면 그 게임 상세)
// 로그인(member): 이미지 없이 헤더 아래 멘트(MemberHeadline, 2시간마다) → 검색창. 헤더는 흐름 안에서 아래 1px 선
// 검색 결과를 볼 때는 예전 모양(검색창 줄만)으로 돌아간다 — 검색창이 같은 자리에 남도록 요소 위치는 모드가 같고 클래스만 바뀐다 (입력 중 포커스 유지)
// home-only로 감싼 부분은 필터 주소로 들어온 첫 HTML에서 숨김 (globals.css)
// 상황 타일("이런 판 어때요?")·인원 탭·필터 칩·현황 숫자는 히어로 밖 섹션에 있다 (HomeSections)
export default function MainHero({ games, filters, showHome, sidebar = false, hero = null, heroLines = [], member = false }: { games: any[]; filters: GameFilters; showHome: boolean; sidebar?: boolean; hero?: HeroFeatured | null; heroLines?: string[]; member?: boolean }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <div className={showHome ? (member ? 'mn-top' : 'mn-hero') : 'home-hero'}>
      {showHome && !member && hero && (
        <div className="home-only mn-hero-media" aria-hidden="true">
          <img src={hero.src} srcSet={`${hero.srcSmall} 1920w, ${hero.src} 3840w`} sizes="100vw" alt="" width={3840} height={1240} loading="eager" decoding="async" fetchPriority="high" />
        </div>
      )}
      {showHome && !member && hero && (
        <div className="home-only mn-hero-credit">
          <GameLink href={`/games/${hero.id}`}>{hero.title}</GameLink>
        </div>
      )}
      <div className={showHome ? 'mn-wrap mn-hero-inner' : undefined}>
        {showHome && !member && (
          <div className="home-only mn-intro" data-tour="hero">
            <h1 className="mn-h1">금요일 밤,<br className="mn-h1-br" /> 친구들이랑 뭐 하지?</h1>
            <p className="mn-hero-sub">몇 명이서, 어떻게 놀지만 고르면 같이 할 게임을 찾아줘요.</p>
          </div>
        )}
        {showHome && member && <div className="home-only mn-intro"><MemberHeadline lines={heroLines} /></div>}
        {showHome ? (
          // 홈: 에어비앤비식 3칸 검색창. 결과 화면(아래)은 예전 검색창 그대로
          <div className="ab-hero" data-tour="cmdbar">
            {/* AI 추천 버튼(AIRecommend, trailing 자리)은 당분간 그리지 않는다 — 코드는 그대로, 나중에 한 줄 상황 입력으로 다시 쓸 예정 */}
            {member
              ? <div data-tour="welcome-member"><AbSearch games={games} /></div>
              : <AbSearch games={games} />}
          </div>
        ) : (
          <div className="home-search">
            <SearchPanel games={games} filters={filters} sidebar={sidebar} floating={false} />
          </div>
        )}
      </div>
    </div>
  );
}
