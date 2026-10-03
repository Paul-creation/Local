// 커뮤니티 서버 전용 모듈 — 브라우저 컴포넌트('use client')에서 import 금지 (service role 키 사용)
// 읽기·쓰기 모두 여기 db로 처리하고, 응답에는 PUBLIC_* 칸만 담는다 (password_hash·ip_hash 절대 노출 금지).
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import { LIMITS, type BoardKey } from './communityBoards';

export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const PUBLIC_POST_LIST = 'id, board, title, nickname, game_id, like_count, comment_count, created_at, games(id, name)';
export const PUBLIC_POST = 'id, board, title, body, nickname, game_id, like_count, comment_count, hidden, created_at, updated_at, games(id, name)';
export const PUBLIC_COMMENT = 'id, post_id, body, nickname, hidden, created_at';

export const DAILY_POSTS_PER_IP = 10;
export const DAILY_COMMENTS_PER_IP = 30;
export const MAX_LINKS = 2;
export const HIDE_AT_REPORTS = 3;
export const PAGE_SIZE = 20;

export type PostListItem = {
  id: number; board: BoardKey; title: string; nickname: string; game_id: string | null;
  like_count: number; comment_count: number; created_at: string;
  games: { id: string; name: string } | null;
};

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const since24h = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
export const parseId = (v: string) => (/^\d{1,18}$/.test(v) ? Number(v) : null);

// IP는 투표 API와 같은 방식으로 해시만 저장
export const ipHash = (ip: string) =>
  createHash('sha256').update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')).digest('hex').slice(0, 32);

// 비밀번호: scrypt(느린 비밀번호 전용 해시) + 글마다 다른 salt. 형식 scrypt$salt$hash
const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
export async function hashPassword(pw: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await scryptAsync(pw, salt, 32)).toString('hex')}`;
}
export async function verifyPassword(pw: string, stored: string) {
  const [kind, salt, hex] = (stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hex) return false;
  const a = await scryptAsync(pw, salt, 32);
  const b = Buffer.from(hex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
// 비밀번호 틀림 → 잠깐 늦게 응답 (마구 대입 방지)
export const wrongPassword = async () => {
  await new Promise((r) => setTimeout(r, 700));
  return fail('비밀번호가 맞지 않아요.', 403);
};

// 기본 금지어 (띄어쓰기·기호를 빼고 비교). 필요하면 여기에 추가
const BANNED = [
  // 욕설
  '시발', '씨발', '씨빨', '씨바', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '좆', '존나', '개새끼', '개색기', '개새기', '지랄', 'ㅈㄹ',
  '니애미', '니미', '느금', '엠창', '애미뒤', '창녀', '걸레년', '미친년', '미친놈', '닥쳐', '꺼져', '등신', 'fuck', 'shit',
  // 광고·불법
  '카지노', '바카라', '토토사이트', '먹튀', '슬롯사이트', '홀덤사이트', '대출', '출장안마', '출장마사지', '조건만남',
  '성인방송', '야동', '오피사이트', '불법촬영', '마약', '작업대출', '코인리딩', '리딩방', '고수익보장', '부업문의',
];
const squash = (s: string) => s.toLowerCase().replace(/[\s.,·_\-~!@#$%^&*()+=|\\/'"`?<>[\]{}:;]/g, '');
export const hasBanned = (s: string) => {
  const t = squash(s);
  return BANNED.some((w) => t.includes(w));
};
export const countLinks = (s: string) =>
  (s.match(/https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(com|net|kr|io|gg|me|ly|xyz|org|co)\b\S*/gi) || []).length;

// 보이지 않는 제어 문자 제거 + 앞뒤 공백 정리 (줄바꿈·탭은 유지)
export const clean = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').trim() : '';

const len = (s: string) => [...s].length;
export function checkLength(label: string, value: string, [min, max]: readonly [number, number]) {
  const n = len(value);
  if (n < min) return `${label}을(를) ${min}자 이상 써주세요.`;
  if (n > max) return `${label}은(는) ${max}자까지 쓸 수 있어요.`;
  return null;
}

// 글·댓글 공통 검사 → 문제 있으면 안내 문구, 없으면 null
export function checkText(text: string) {
  if (hasBanned(text)) return '사용할 수 없는 표현이 들어 있어요. 운영정책을 확인해주세요.';
  if (countLinks(text) > MAX_LINKS) return `링크는 ${MAX_LINKS}개까지 넣을 수 있어요.`;
  return null;
}

export function checkAuthor(nickname: string, password: unknown) {
  const pw = typeof password === 'string' ? password : '';
  return (
    checkLength('닉네임', nickname, LIMITS.nickname) ||
    (/관리자|운영자|admin/i.test(nickname) ? '사용할 수 없는 닉네임이에요.' : null) ||
    (hasBanned(nickname) ? '사용할 수 없는 닉네임이에요.' : null) ||
    checkLength('비밀번호', pw, LIMITS.password)
  );
}

// 숨기지 않은 댓글 수로 게시글 comment_count를 다시 맞춘다
export async function syncCommentCount(postId: number) {
  const { count } = await db.from('post_comments').select('id', { count: 'exact', head: true }).eq('post_id', postId).eq('hidden', false);
  await db.from('posts').update({ comment_count: count ?? 0 }).eq('id', postId);
}

// ---- 읽기 (서버 컴포넌트용) ----

export async function listPosts(board: BoardKey | null, page = 1) {
  let q = db.from('posts').select(PUBLIC_POST_LIST, { count: 'exact' }).eq('hidden', false);
  if (board) q = q.eq('board', board);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await q.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  return { posts: (data || []) as unknown as PostListItem[], total: count ?? 0 };
}

// 메인 인기 게시물: 최근 7일, 추천+댓글 많은 순 5개. 5개 미만이면 빈 배열(섹션 숨김)
export async function getPopularPosts(): Promise<PostListItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db.from('posts').select(PUBLIC_POST_LIST).eq('hidden', false).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(300);
  const posts = ((data || []) as unknown as PostListItem[])
    .sort((a, b) => (b.like_count + b.comment_count) - (a.like_count + a.comment_count))
    .slice(0, 5);
  return posts.length < 5 ? [] : posts;
}

export async function getGamePosts(gameId: string): Promise<PostListItem[]> {
  const { data } = await db.from('posts').select(PUBLIC_POST_LIST).eq('hidden', false).eq('game_id', gameId)
    .order('created_at', { ascending: false }).limit(3);
  return (data || []) as unknown as PostListItem[];
}
