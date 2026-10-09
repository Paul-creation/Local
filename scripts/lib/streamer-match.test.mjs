// 실행: npm test — 스트리머 영상 → 게임 연결 (조사에 쓴 실패 25개 + 기존 연결 5개 + 오탐 방지)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMatchers } from '../../app/lib/gameMatch.mjs';
import { matchVideo } from './streamer-match.mjs';

const sample = JSON.parse(fs.readFileSync(new URL('./fixtures/streamer-sample.json', import.meta.url), 'utf8'));

// 운영 카탈로그의 관련 게임 (별칭은 보강 SQL을 적용한 뒤의 값, 하늘의 궤적은 별칭 없이 이름 정규화만으로 맞춘다)
const GAMES = [
  { id: 'lol', name: 'League of Legends', search_name_ko: '롤, 리그 오브 레전드' },
  { id: 'tft', name: 'Teamfight Tactics', search_name_ko: 'TFT' },
  { id: 'ow', name: 'Overwatch 2', search_name_ko: '오버워치 2, 오버워치' },
  { id: 'dbd', name: 'Dead by Daylight', search_name_ko: '데드 바이 데이라이트, DBD, 데바데' },
  { id: 'zomboid', name: 'Project Zomboid', search_name_ko: '프로젝트 좀보이드, 좀보이드' },
  { id: 'sky', name: '하늘의 궤적 the 2nd', search_name_ko: null },
  { id: 'valorant', name: 'VALORANT', search_name_ko: '발로란트' },
  { id: 'gears', name: 'Gears of War: E-Day', search_name_ko: '기어스 오브 워 이데이' },
  { id: 'racer', name: '스타워즈: 은하계 레이서™', search_name_ko: null },
  { id: 'liars', name: "Liar's Bar", search_name_ko: '라이어스 바' },
];
const byId = new Map(GAMES.map((g) => [g.id, g]));
const matchers = buildMatchers(GAMES);
const link = (v) => { const h = matchVideo({ title: v.title, description: v.description || '', is_short: !!v.is_short }, matchers, byId); return h ? byId.get(h.id).name : null; };

// 실패 25개 결과 (순서는 fixtures/streamer-sample.json의 fails)
const EXPECT = {
  3: '하늘의 궤적 the 2nd', // 롤 + 하늘의 궤적 2nd → 한 영상에는 가장 긴 이름 하나
  4: '하늘의 궤적 the 2nd',
  8: 'Overwatch 2', // 오버워치 + 데바데 → 더 긴 이름
  10: 'Project Zomboid', // 제목엔 없고 설명 앞부분에 "좀보이드 - 6편"
  11: 'Project Zomboid',
};

test('실패 25개: 연결 결과 표 (5개 연결, 나머지는 카탈로그에 없거나 게임 이름이 없어 그대로 미연결)', () => {
  assert.equal(sample.fails.length, 25);
  const table = sample.fails.map((v, i) => ({ n: i + 1, title: v.title.slice(0, 40), got: link(v) }));
  for (const r of table) assert.equal(r.got, EXPECT[r.n] ?? null, `${r.n}번 ${r.title}`);
  assert.equal(table.filter((r) => r.got).length, 5);
});

test('"롤 리프트바운드 카드깡"은 League of Legends로 연결되면 안 됨', () => {
  const v = sample.fails.find((x) => x.title.includes('롤 리프트바운드 카드깡'));
  assert.ok(v);
  assert.equal(link(v), null);
});

test('롤케이크·롤러코스터·롤링 같은 낱말은 연결되면 안 됨 (제목·설명 어디에서도)', () => {
  for (const t of ['롤케이크 만들기', '롤러코스터 타봤다', '롤링 스톤즈 공연', '롤드컵 결승 직관', '#롤케이크 #브이로그']) {
    assert.equal(link({ title: t, description: '롤러코스터 롤링 롤케이크' }), null, t);
  }
});

test('"롤"이 독립된 단어인 방송은 연결: 롤 렁키즈 내전 · 롤 물음표 수집가', () => {
  assert.equal(link({ title: '2026년 10월 08일 방송 (롤 렁키즈 내전 마무리)' }), 'League of Legends');
  assert.equal(link({ title: '롤 물음표 수집가' }), 'League of Legends');
  assert.equal(link({ title: '[롤] 솔랭 1대1' }), 'League of Legends');
});

test('설명의 채널 소개 문구("롤, 메인 영상…")만으로는 롤로 연결 안 됨 (1글자 별칭은 제목에서만)', () => {
  const desc = '본진 괴물쥐 유튜브에는 롤, 메인 영상을 올립니다';
  assert.equal(link({ title: '오늘의 일상 브이로그', description: desc }), null);
  assert.equal(link({ title: '롤 방송', description: desc }), 'League of Legends');
});

test('기존 연결 5개는 그대로 유지', () => {
  assert.equal(sample.linked.length, 5);
  for (const v of sample.linked) assert.equal(link(v), v.expected, v.title.slice(0, 30));
});

test('라이어게임은 라이어스 바로 연결하지 않음 (같은 게임인지 확인 전까지 보류)', () => {
  assert.equal(link({ title: '형, 몸이 굳었네? | 라이어게임 (w.삼식,탬탬버린)' }), null);
});
