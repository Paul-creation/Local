-- game_votes 중복 방지 인덱스 기록: 같은 사람(voter_hash)이 같은 게임의 같은 상황에 한 번만 투표
-- 이미 DB에 적용돼 있음. 저장소에 기록만 남기는 파일이라 다시 실행해도 안전 (if not exists)
-- voter_hash가 null인 행(90일 뒤 IP 해시를 비운 투표)은 대상이 아님 (app/api/votes/route.ts가 23505를 duplicate로 응답)
create unique index if not exists game_votes_one_per_voter on public.game_votes using btree (game_id, situation, voter_hash) where (voter_hash is not null);
