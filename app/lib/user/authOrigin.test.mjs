// 실행: npm test — 스팀 로그인에 쓸 origin 고르기 (허용 목록 밖은 운영 주소, 오픈 리다이렉트 방지)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedAuthOrigin, requestHost, resolveAuthOrigin } from './authOrigin.ts';
import { buildLoginUrl, checkAssertion } from './steamOpenId.ts';

const SITE = 'https://select-screen.com';
const ENV = { VERCEL_URL: 'game-info-hub-abc123-paul-shin-s-projects.vercel.app', VERCEL_BRANCH_URL: 'game-info-hub-git-feat-main-v2-paul-shin-s-projects.vercel.app' };

test('허용 origin은 그대로, 대소문자는 정리', () => {
  assert.equal(resolveAuthOrigin('select-screen.com', SITE, {}), 'https://select-screen.com');
  assert.equal(resolveAuthOrigin('WWW.select-screen.com', SITE, {}), 'https://www.select-screen.com');
  assert.equal(resolveAuthOrigin(ENV.VERCEL_URL, SITE, ENV), `https://${ENV.VERCEL_URL}`);
  assert.equal(resolveAuthOrigin(ENV.VERCEL_BRANCH_URL, SITE, ENV), `https://${ENV.VERCEL_BRANCH_URL}`);
  assert.equal(resolveAuthOrigin('game-info-hub-git-feat-x-paul-shin-s-projects.vercel.app', SITE, {}), 'https://game-info-hub-git-feat-x-paul-shin-s-projects.vercel.app');
});

test('그 밖의 주소는 전부 운영 주소로', () => {
  const bad = [
    'evil.com', 'select-screen.com.evil.com', 'evilselect-screen.com', 'evil.com/select-screen.com', 'select-screen.com@evil.com', 'evil.com#select-screen.com',
    'game-info-hub-x-paul-shin-s-projects.vercel.app.evil.com', 'x.evil.com/game-info-hub-x-paul-shin-s-projects.vercel.app',
    'evil-paul-shin-s-projects.vercel.app', 'other-git-x-paul-shin-s-projects.vercel.app', 'game-info-hub.vercel.app',
    'select-screen.com:8443', 'localhost:3000', 'http://select-screen.com', '', null, undefined, 'a b', '//evil.com', 'javascript:alert(1)',
  ];
  for (const h of bad) assert.equal(resolveAuthOrigin(h, SITE, {}), SITE, String(h));
  // VERCEL_URL 값이 비어 있어도 빈 host가 통과하지 않는다
  assert.equal(resolveAuthOrigin('', SITE, { VERCEL_URL: '' }), SITE);
  assert.equal(isAllowedAuthOrigin('https://evil.com', SITE, {}), false);
});

test('로그인 주소: 프리뷰 origin이면 realm·return_to가 프리뷰, 아니면 운영', () => {
  const pv = resolveAuthOrigin(ENV.VERCEL_BRANCH_URL, SITE, ENV);
  const q = new URL(buildLoginUrl(pv, '/find')).searchParams;
  assert.equal(q.get('openid.realm'), pv);
  assert.equal(q.get('openid.return_to'), `${pv}/api/auth/steam/callback?next=%2Ffind`);
  const q2 = new URL(buildLoginUrl(resolveAuthOrigin('evil.com', SITE, ENV), '/')).searchParams;
  assert.equal(q2.get('openid.realm'), SITE);
});

test('콜백 확인: return_to 의 origin이 지금 origin과 다르면 거부', () => {
  const pv = `https://${ENV.VERCEL_BRANCH_URL}`;
  const now = Date.now();
  const nonce = new Date(now).toISOString().slice(0, 19) + 'Zabc';
  const mk = (returnTo) => new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0', 'openid.mode': 'id_res', 'openid.op_endpoint': 'https://steamcommunity.com/openid/login',
    'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000000', 'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000000',
    'openid.return_to': returnTo, 'openid.response_nonce': nonce, 'openid.assoc_handle': 'h', 'openid.sig': 's',
    'openid.signed': 'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
  });
  assert.equal(checkAssertion(mk(`${pv}/api/auth/steam/callback?next=%2F`), pv, now).ok, true);
  assert.equal(checkAssertion(mk(`${SITE}/api/auth/steam/callback?next=%2F`), pv, now).ok, false);
  assert.equal(checkAssertion(mk(`https://evil.com/api/auth/steam/callback?next=%2F`), pv, now).ok, false);
});

test('requestHost: x-forwarded-host 우선, 첫 값만', () => {
  assert.equal(requestHost(new Headers({ host: 'a.com' })), 'a.com');
  assert.equal(requestHost(new Headers({ host: 'a.com', 'x-forwarded-host': 'b.com, c.com' })), 'b.com');
});
