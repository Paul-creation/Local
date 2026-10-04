import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '../../lib/adminAuth';
import { getIp } from '../../lib/aiGuard';
import { LIMITS } from '../../lib/communityBoards';
import {
  db, fail, clean, ipHash, hashPassword, checkLength, checkText, checkAuthor, since24h,
  DAILY_GAME_COMMENTS_PER_IP, PUBLIC_GAME_COMMENT,
} from '../../lib/community';
import { selectGames } from '../../lib/visibleGames';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 게임 상세 "의견 달기" — 제목 없이 닉네임·비밀번호·짧은 본문
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('잘못된 요청이에요.');

  const gameId = String(body.gameId || '');
  const text = clean(body.body);
  const nickname = clean(body.nickname).replace(/\s+/g, ' ');
  const asAdmin = isAdmin(req); // 관리자 로그인 상태면 운영자 닉네임 허용 + "운영자" 배지
  if (!UUID.test(gameId)) return fail('게임이 올바르지 않아요.');
  const problem = checkLength('의견', text, LIMITS.gameComment) || checkAuthor(nickname, body.password, asAdmin) || checkText(text);
  if (problem) return fail(problem);

  const ip_hash = ipHash(getIp(req.headers));
  const [{ data: game }, { count }] = await Promise.all([
    selectGames('id', undefined, db).eq('id', gameId).maybeSingle(),
    db.from('game_comments').select('id', { count: 'exact', head: true }).eq('ip_hash', ip_hash).gte('created_at', since24h()),
  ]);
  if (!game) return fail('게임을 찾을 수 없어요.', 404);
  if ((count ?? 0) >= DAILY_GAME_COMMENTS_PER_IP) return fail('오늘은 의견을 충분히 남겼어요. 내일 다시 남겨주세요.', 429);

  const { data, error } = await db.from('game_comments').insert({
    game_id: gameId, body: text, nickname, password_hash: await hashPassword(body.password), ip_hash, is_admin: asAdmin,
  }).select(PUBLIC_GAME_COMMENT).single();
  if (error || !data) return fail('저장하지 못했어요. 잠시 후 다시 시도해주세요.', 500);
  revalidatePath(`/games/${gameId}`); // 상세 페이지 캐시(1시간)를 바로 새로
  return NextResponse.json({ comment: { ...data, hidden: false } });
}
