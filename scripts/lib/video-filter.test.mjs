// 실행: npm test — 트레일러 대체 검색 검증 규칙 (trailerRejectReason)
import test from 'node:test';
import assert from 'node:assert/strict';
import { trailerRejectReason, englishNameKeys } from './video-filter.mjs';
import { gameNameKeys } from './coop-targets.mjs';

const fishing = { name: '낚시 방법', search_name_ko: '낚시 방법' };
const bg3 = { name: "Baldur's Gate 3", search_name_ko: '발더스 게이트 3' };
const check = (game, title, channel_title = '') => trailerRejectReason({ title, channel_title }, gameNameKeys(game));
// enrich-videos와 같이 영어 원제(스토어 주소 이름)도 이름 후보에 넣어서 검사
const checkEn = (game, title, channel_title = '') => trailerRejectReason({ title, channel_title }, [...gameNameKeys(game), ...englishNameKeys(game)]);
const ghost = { name: '고스트러너 2', search_name_ko: '고스트러너 2', external_id: 'ghostrunner-2' };

test('낚시 강좌 영상은 탈락 (한글 이름 세 글자 이상 예외 삭제 + 트레일러 단서 없음)', () => {
  const r = check(fishing, '초보자를 위한 우럭 라이트 지깅 낚시 방법, 준비물 알아보기!! #홍원항#서천', '홍원항TV항구낚시');
  assert.ok(r);
});

test('"방법"이 이름에 든 게임이라도 트레일러 단서가 없으면 탈락', () => {
  assert.equal(check(fishing, '낚시 방법 공식 트레일러'), null); // 이름 속 단어는 봐주고 공식 트레일러면 통과
  assert.ok(check(fishing, '낚시 방법 스트리머 영상'));
});

test('리뷰·speedrun·Part 1 은 탈락', () => {
  assert.match(check(bg3, "Baldur's Gate 3 Review: Is it worth it? Official"), /트레일러가 아닌 단어/);
  assert.match(check(bg3, "I tried speedrunning Baldur's Gate 3 | gameplay"), /트레일러가 아닌 단어/);
  assert.match(check(bg3, "Baldur's Gate 3 | Part 1 | Gameplay Walkthrough"), /트레일러가 아닌 단어/);
  assert.match(check(bg3, "Baldur's Gate 3 - EP 2 gameplay"), /트레일러가 아닌 단어/);
  assert.match(check(bg3, "Baldur's Gate 3 how to guide trailer"), /트레일러가 아닌 단어/);
  assert.match(check(bg3, '발더스 게이트 3 공략 공식 트레일러'), /트레일러가 아닌 단어/);
});

test('"Official Trailer" 는 통과', () => {
  assert.equal(check(bg3, "Baldur's Gate 3 - Official Trailer"), null);
  assert.equal(check(bg3, '발더스 게이트 3 공식 트레일러'), null);
  assert.equal(check(bg3, "Baldur's Gate 3 | Launch Trailer | PS5"), null);
});

test('영어 원제 트레일러 통과 (DB에 한글 검색 이름이 같이 있어도)', () => {
  assert.equal(check(bg3, "Baldur's Gate 3 - Gameplay Reveal", 'Larian Studios'), null);
});

test('채널에만 이름이 있으면 탈락 (제목에 게임 이름 필수)', () => {
  assert.equal(check(bg3, 'Official Launch Trailer', "Baldur's Gate 3"), '제목에 게임 이름 없음');
});

test('제목에 게임 이름은 있지만 트레일러 단서가 없으면 탈락', () => {
  assert.equal(check(bg3, "Baldur's Gate 3 is amazing", 'Some Channel'), '트레일러 단서 없음');
});

test('영화 단어는 이전처럼 탈락', () => {
  assert.equal(check(bg3, "Baldur's Gate 3 The Movie Official Trailer"), '영화 단어');
});

test('"Announce Cinematic" 통과 (announce·cinematic 단서)', () => {
  assert.equal(check({ name: 'StarCraft II' }, 'StarCraft II Announce Cinematic'), null);
  assert.equal(check({ name: 'StarCraft II' }, 'StarCraft II: Heart of the Swarm Opening Cinematic'), null);
});

test('"오프닝 영상"·시네마틱·티저·reveal 통과', () => {
  const g = { name: '베리드 스타즈 (BURIED STARS)', search_name_ko: '베리드 스타즈' };
  assert.equal(check(g, '[베리드 스타즈] 오프닝 영상', 'LINE GAMES'), null);
  assert.equal(check(g, '베리드 스타즈 시네마틱'), null);
  assert.equal(check(g, '베리드 스타즈 티저'), null);
  assert.equal(check({ name: 'Foo Bar' }, 'Foo Bar Teaser'), null);
  assert.equal(check({ name: 'Foo Bar' }, 'Foo Bar Reveal'), null);
});

test('영어 원제(external_id)로 통과: 한글 이름 게임에 영어 제목 트레일러', () => {
  assert.equal(check(ghost, 'Ghostrunner 2 - Official Release Date Trailer', 'IGN'), '제목에 게임 이름 없음'); // 한글 이름만으로는 탈락
  assert.equal(checkEn(ghost, 'Ghostrunner 2 - Official Release Date Trailer', 'IGN'), null);
});

test('englishNameKeys: 에픽 해시 제거, 글자 없는 값·스팀 게임은 빈 배열', () => {
  assert.deepEqual(englishNameKeys({ external_id: 'out-of-sight-b96ca8' }), ['outofsight']);
  assert.deepEqual(englishNameKeys({ external_id: 'alan-wake-2' }), ['alanwake2']);
  assert.deepEqual(englishNameKeys({ external_id: 'fortnite' }), ['fortnite']);
  assert.deepEqual(englishNameKeys({ external_id: '2xko' }), ['2xko']); // 글자가 3개 이상이면 짧은 이름도 씀
  assert.deepEqual(englishNameKeys({ external_id: 'ab-12' }), []); // 글자 3개 미만은 안 씀
  assert.deepEqual(englishNameKeys({ external_id: '9f3a1c77' }), []); // 주소 이름이 아닌 숫자·해시 값
  assert.deepEqual(englishNameKeys({ external_id: null }), []); // 스팀 게임은 저장된 칸 없음
});

test('영어 원제로 통과해도 트레일러 단서·제외 단어 규칙은 그대로', () => {
  assert.match(checkEn(ghost, 'Ghostrunner 2 Review', 'IGN'), /트레일러가 아닌 단어/);
  assert.equal(checkEn(ghost, 'Ghostrunner 2 is great', 'IGN'), '트레일러 단서 없음');
});
