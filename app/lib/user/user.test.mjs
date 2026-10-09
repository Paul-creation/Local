// 실행: npm test — 스팀 OpenID 검증·세션 쿠키 (실제 스팀에는 접속하지 않고 가짜 fetch를 쓴다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserSessionToken, verifyUserSessionToken } from './session.ts';
import { buildLoginUrl, checkAssertion, sanitizeNext, verifySteamLogin } from './steamOpenId.ts';
import { cleanProfile } from './steamProfile.ts';

const SITE = 'https://example.test';
const UID = '123e4567-e89b-42d3-a456-426614174000';
const STEAM = '76561198000000000';
const NOW = Date.parse('2026-10-16T12:00:00Z');

process.env.USER_SESSION_SECRET = 'test-secret-test-secret-test-secret';

test('세션 토큰: 만들고 검증, 변조·만료·다른 키는 거부', () => {
  const t = createUserSessionToken(UID, NOW);
  assert.equal(verifyUserSessionToken(t, NOW + 1000), UID);
  const [id, exp, sig] = t.split('.');
  assert.equal(verifyUserSessionToken(`${id.replace('123e', '123f')}.${exp}.${sig}`, NOW), null);
  assert.equal(verifyUserSessionToken(`${id}.${Number(exp) + 99999}.${sig}`, NOW), null);
  assert.equal(verifyUserSessionToken(t, NOW + 31 * 86400 * 1000), null);
  assert.equal(verifyUserSessionToken('', NOW), null);
  assert.equal(verifyUserSessionToken('a.b', NOW), null);
  process.env.USER_SESSION_SECRET = 'another-secret-another-secret-0000';
  assert.equal(verifyUserSessionToken(t, NOW), null);
  process.env.USER_SESSION_SECRET = '';
  assert.equal(verifyUserSessionToken(t, NOW), null); // 키가 없으면 전부 거부
  assert.throws(() => createUserSessionToken(UID, NOW));
  process.env.USER_SESSION_SECRET = 'test-secret-test-secret-test-secret';
});

test('next: 사이트 안 경로만', () => {
  assert.equal(sanitizeNext('/wishlist?ids=a,b'), '/wishlist?ids=a,b');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '/api/me', '', null, undefined, '/a b']) assert.equal(sanitizeNext(bad), '/');
});

test('로그인 주소: return_to·realm은 사이트 주소 기준', () => {
  const u = new URL(buildLoginUrl(SITE + '/', '/compare?x=1'));
  assert.equal(u.origin + u.pathname, 'https://steamcommunity.com/openid/login');
  assert.equal(u.searchParams.get('openid.realm'), SITE);
  assert.equal(u.searchParams.get('openid.return_to'), `${SITE}/api/auth/steam/callback?next=%2Fcompare%3Fx%3D1`);
});

const good = (over = {}) => {
  const p = {
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM}`,
    'openid.identity': `https://steamcommunity.com/openid/id/${STEAM}`,
    'openid.return_to': `${SITE}/api/auth/steam/callback?next=%2Fwishlist`,
    'openid.response_nonce': '2026-10-16T12:00:00ZabcDEF',
    'openid.assoc_handle': '1234567890',
    'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.sig': 'c2ln+/=',
    ...over,
  };
  for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
  return new URLSearchParams(p);
};

test('응답 확인: 정상이면 SteamID와 돌아갈 곳', () => {
  assert.deepEqual(checkAssertion(good(), SITE, NOW), { ok: true, steamId: STEAM, next: '/wishlist' });
});

test('응답 확인: 하나라도 어긋나면 거부', () => {
  const cases = {
    mode_cancel: { 'openid.mode': 'cancel' },
    ns: { 'openid.ns': 'http://specs.openid.net/auth/1.1' },
    op_endpoint: { 'openid.op_endpoint': 'https://evil.test/openid/login' },
    claimed_host: { 'openid.claimed_id': `https://evil.test/openid/id/${STEAM}`, 'openid.identity': `https://evil.test/openid/id/${STEAM}` },
    claimed_short: { 'openid.claimed_id': 'https://steamcommunity.com/openid/id/123', 'openid.identity': 'https://steamcommunity.com/openid/id/123' },
    claimed_http: { 'openid.claimed_id': `http://steamcommunity.com/openid/id/${STEAM}`, 'openid.identity': `http://steamcommunity.com/openid/id/${STEAM}` },
    claimed_suffix: { 'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM}9`, 'openid.identity': `https://steamcommunity.com/openid/id/${STEAM}9` },
    identity_differs: { 'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000001' },
    return_to_host: { 'openid.return_to': 'https://evil.test/api/auth/steam/callback?next=%2F' },
    return_to_path: { 'openid.return_to': `${SITE}/other?next=%2F` },
    nonce_old: { 'openid.response_nonce': '2026-10-16T11:00:00Zabc' },
    nonce_bad: { 'openid.response_nonce': 'garbage' },
    unsigned: { 'openid.signed': 'signed,op_endpoint,claimed_id,identity,response_nonce,assoc_handle' }, // return_to 빠짐
    no_sig: { 'openid.sig': undefined },
  };
  for (const [name, over] of Object.entries(cases)) assert.equal(checkAssertion(good(over), SITE, NOW).ok, false, name);
  const dup = good(); dup.append('openid.claimed_id', `https://steamcommunity.com/openid/id/${STEAM}`);
  assert.equal(checkAssertion(dup, SITE, NOW).ok, false, 'duplicate');
});

test('next는 스팀이 서명한 return_to 안의 값만 쓴다 (요청 주소의 next는 무시)', () => {
  const q = good(); q.set('next', '/admin');
  assert.equal(checkAssertion(q, SITE, NOW).next, '/wishlist');
  assert.equal(checkAssertion(good({ 'openid.return_to': `${SITE}/api/auth/steam/callback?next=%2F%2Fevil.com` }), SITE, NOW).next, '/');
});

test('스팀 재검증: is_valid:true일 때만 통과, 보내는 값은 mode만 바뀜', async () => {
  let sent;
  const mk = (text, ok = true) => async (_u, init) => { sent = init; return { ok, text: async () => text }; };
  // 실제 시계를 쓰지 않도록 nonce를 지금 시각으로
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const q = good({ 'openid.response_nonce': now + 'abc' });
  const r = await verifySteamLogin(q, SITE, mk('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'));
  assert.deepEqual(r, { ok: true, steamId: STEAM, next: '/wishlist' });
  assert.equal(sent.method, 'POST');
  assert.equal(sent.body.get('openid.mode'), 'check_authentication');
  assert.equal(sent.body.get('openid.sig'), 'c2ln+/=');
  for (const text of ['ns:x\nis_valid:false\n', '', 'is_valid:truee', 'xis_valid:true']) assert.equal((await verifySteamLogin(q, SITE, mk(text))).ok, false, text);
  assert.equal((await verifySteamLogin(q, SITE, mk('is_valid:true', false))).ok, false); // HTTP 오류
  assert.equal((await verifySteamLogin(q, SITE, async () => { throw new Error('network'); })).ok, false);
  // 로컬 검사에서 걸리면 스팀에 묻지도 않음
  let called = false;
  assert.equal((await verifySteamLogin(good({ 'openid.mode': 'cancel' }), SITE, async () => { called = true; return { ok: true, text: async () => 'is_valid:true' }; })).ok, false);
  assert.equal(called, false);
});

test('프로필 정리: 이름 다듬기, 스팀 이미지 주소만', () => {
  assert.deepEqual(cleanProfile({ personaname: '  홍길동\n', avatarmedium: 'https://avatars.steamstatic.com/abc_medium.jpg' }), { persona_name: '홍길동', avatar_url: 'https://avatars.steamstatic.com/abc_medium.jpg' });
  assert.equal(cleanProfile({ avatarmedium: 'https://evil.test/a.jpg' }).avatar_url, null);
  assert.equal(cleanProfile({ avatarmedium: 'http://avatars.steamstatic.com/a.jpg' }).avatar_url, null);
  assert.equal(cleanProfile({ avatarmedium: 'https://steamstatic.com.evil.test/a.jpg' }).avatar_url, null);
  assert.equal(cleanProfile(null).persona_name, null);
  assert.equal([...cleanProfile({ personaname: 'a'.repeat(100) }).persona_name].length, 64);
});
