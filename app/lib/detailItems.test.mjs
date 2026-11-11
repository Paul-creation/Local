// 상세 페이지 재배치 때 항목이 빠지지 않게 하는 소스 점검. 실제 렌더 확인은 npm run verify-detail
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playTime } from './playTime.ts';

const page = readFileSync(new URL('../games/[id]/page.tsx', import.meta.url), 'utf8');

const SECTIONS = ['한눈에 보기', '가격·할인', '플레이 방식', '어떤 게임인가요?', '게임 정보'];
const TILES = ['인원', '진입장벽', '한국어', '역대 최저가'];
const PLAY = ['인원 범위', '추천 인원', '같은 서버', '혼자 하기', '크로스플레이', '서버 방식', '멀티 방식', '진입장벽 이유'];
const ABOUT = ['가능한 활동', '엔딩', '클리어까지'];
const INFO = ['개발', '배급', '출시일', '플랫폼', 'ITAD 인기 순위', '도전과제', 'DLC', '가족 공유', '마지막 업데이트', '필요 용량', '모드 지원'];
const COLUMNS = ['story_length', 'entry_barrier', 'korean_support', 'min_players', 'max_players', 'party_max', 'developer', 'publisher', 'has_ending', 'server_type', 'has_workshop', 'recommended_players', 'session_max'];

test('상세 페이지 섹션 제목이 모두 있다', () => {
  for (const t of SECTIONS) assert.ok(page.includes(`aria-label="${t}"`) && page.includes(t), `섹션 없음: ${t}`);
});

test('한눈에 보기 타일 라벨이 모두 있다', () => {
  for (const l of TILES) assert.ok(page.includes(`label: '${l}'`), `타일 없음: ${l}`);
});

test('플레이 방식·어떤 게임인가요?·게임 정보 항목 라벨이 모두 있다', () => {
  for (const l of PLAY) assert.ok(page.includes(`['${l}'`), `플레이 방식 항목 없음: ${l}`);
  for (const l of ABOUT) assert.ok(page.includes(`['${l}'`), `어떤 게임인가요? 항목 없음: ${l}`);
  for (const l of INFO) assert.ok(page.includes(`['${l}'`), `게임 정보 항목 없음: ${l}`);
});

test('화면에 쓰는 games 컬럼을 상세 페이지가 계속 읽는다 (min_players는 playersText가 읽는다)', () => {
  for (const c of COLUMNS.filter((c) => c !== 'min_players')) assert.ok(page.includes(`game.${c}`), `컬럼 안 씀: ${c}`);
  assert.ok(page.includes('playersText(game)'));
});

test('플레이 시간 타일은 playTime(game)을 쓰고 라벨은 플레이 시간·함께 클리어까지', () => {
  assert.ok(page.includes('playTime(game)') && page.includes('label: pt.label'));
  assert.equal(playTime({ ttb_normally: 36000 }).label, '플레이 시간');
  assert.equal(playTime({ solo_mode: 'none', ttb_normally: 54000 }).label, '함께 클리어까지');
});
