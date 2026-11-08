import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKoreanSupport, koreanLabel } from './korean-support.mjs';

const OTT = 'English<strong>*</strong>, French, Japanese, Korean, Polish<br><strong>*</strong>languages with full audio support';

test('One Tank Trip: 영어만 음성, 한국어는 자막', () => assert.equal(parseKoreanSupport(OTT), '자막'));
test('한국어 응답도 같은 결과', () => assert.equal(parseKoreanSupport('영어<strong>*</strong>, 일본어, 한국어<br><strong>*</strong>음성이 지원되는 언어'), '자막'));
test('한국어에 별표가 붙으면 더빙', () => assert.equal(parseKoreanSupport('English, Korean<strong>*</strong><br><strong>*</strong>languages with full audio support'), '자막+더빙'));
test('full_audio_languages에 한국어가 있으면 더빙', () => assert.equal(parseKoreanSupport('English, Korean', 'English, Korean'), '자막+더빙'));
test('한국어가 없으면 한국어 없음', () => assert.equal(parseKoreanSupport('English, French'), '한국어 없음'));
test('언어 칸이 비어 있으면 모름(null)', () => { assert.equal(parseKoreanSupport(undefined), null); assert.equal(parseKoreanSupport(''), null); });
test('카드 문구', () => { assert.equal(koreanLabel('자막'), '한국어 자막'); assert.equal(koreanLabel('자막+더빙'), '한국어 자막+더빙'); assert.equal(koreanLabel('한국어 없음'), null); });
