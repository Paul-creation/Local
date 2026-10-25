import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeHeroWall, halfLums, HERO_LUM } from './heroWall.ts';

const coopNames = ['Rust', 'Valheim', 'Raft', 'PEAK', 'It Takes Two', 'R.E.P.O.', 'Phasmophobia', 'Among Us', 'Palworld / 팰월드', 'Grounded', 'Overcooked! 2', 'Dead by Daylight', 'Split Fiction', 'Lethal Company', 'ARC Raiders', 'Team Fortress 2', 'EA SPORTS FC™ 27', 'War Thunder', 'Apex 레전드™', 'PUBG: BATTLEGROUNDS', 'HELLDIVERS™ 2', 'Sea of Thieves: 2026 Edition', 'Deep Rock Galactic', "Don't Starve Together", 'Monster Hunter Wilds', '인슈라오디드 (Enshrouded)', '톰 클랜시의 레인보우식스 시즈'];
const singles = Object.keys(HERO_LUM).filter((n) => !coopNames.includes(n)).map((name) => ({ name }));
const wall = arrangeHeroWall(coopNames.map((name) => ({ name })), singles).map((g) => g.name);

test('51장 모두 한 번씩', () => {
  assert.equal(wall.length, 51);
  assert.equal(new Set(wall).size, 51);
});

test('1440·1920·2560px에서 왼쪽 절반과 오른쪽 절반 평균 밝기 차가 10% 이내', () => {
  for (const w of [1440, 1920, 2560]) {
    const { left, right } = halfLums(wall, w);
    assert.ok(Math.abs(left - right) / ((left + right) / 2) < 0.1, `${w}px ${left} vs ${right}`);
  }
});

test('협동과 명작이 번갈아 온다', () => {
  const isCoop = (n) => coopNames.includes(n);
  for (let i = 0; i + 1 < 48; i += 2) assert.notEqual(isCoop(wall[i]), isCoop(wall[i + 1]));
});
