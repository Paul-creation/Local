import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../lib/adminAuth';
import { getIp } from '../../../lib/aiGuard';
import { isBoard, LIMITS } from '../../../lib/communityBoards';
import {
  db, fail, clean, ipHash, hashPassword, checkLength, checkText, checkAuthor, since24h, DAILY_POSTS_PER_IP,
} from '../../../lib/community';
import { UUID, findRelatedGames, isMissingRelatedColumn } from '../../../lib/postLinks';
import { selectGames } from '../../../lib/visibleGames';

// 글쓰기
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('잘못된 요청이에요.');

  const board = body.board;
  const title = clean(body.title).replace(/\s+/g, ' ');
  const text = clean(body.body);
  const nickname = clean(body.nickname).replace(/\s+/g, ' ');
  const asAdmin = isAdmin(req); // 관리자 로그인 상태면 운영자 닉네임 허용 + "운영자" 배지
  const gameId = body.gameId ? String(body.gameId) : null;

  if (!isBoard(board)) return fail('게시판을 골라주세요.');
  const problem =
    checkLength('제목', title, LIMITS.title) ||
    checkLength('본문', text, LIMITS.body) ||
    checkAuthor(nickname, body.password, asAdmin) ||
    checkText(`${title}\n${text}`) ||
    (gameId && !UUID.test(gameId) ? '관련 게임이 올바르지 않아요.' : null);
  if (problem) return fail(problem);

  const ip_hash = ipHash(getIp(req.headers));
  const [{ count }, game] = await Promise.all([
    db.from('posts').select('id', { count: 'exact', head: true }).eq('ip_hash', ip_hash).gte('created_at', since24h()),
    gameId ? selectGames('id', undefined, db).eq('id', gameId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if ((count ?? 0) >= DAILY_POSTS_PER_IP) return fail('오늘은 글을 충분히 썼어요. 내일 다시 써주세요.', 429);
  if (gameId && !game.data) return fail('관련 게임을 찾을 수 없어요.');

  const row = {
    board, title, body: text, nickname, game_id: gameId,
    password_hash: await hashPassword(body.password), ip_hash, is_admin: asAdmin,
  };
  const related_game_ids = await findRelatedGames(title, text, gameId);
  let { data, error } = await db.from('posts').insert({ ...row, related_game_ids }).select('id').single();
  if (isMissingRelatedColumn(error)) ({ data, error } = await db.from('posts').insert(row).select('id').single());
  if (error || !data) return fail('저장하지 못했어요. 잠시 후 다시 시도해주세요.', 500);
  return NextResponse.json({ id: data.id });
}
