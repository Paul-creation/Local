-- PC 사양 체커 1단계: 게임별 파싱된 사양(CPU·GPU 등급, RAM, 저장 공간)을 담을 칸 두 개
-- 검수(docs/pc-spec-review.csv)를 마쳐 적용해도 되는 파일. 적용 뒤 parse-specs --apply로 채움 (주간 갱신에도 들어 있음)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전 (기존 데이터는 지우거나 바꾸지 않음)
-- 채우기: node --env-file=.env.local scripts/parse-specs.mjs (미리보기) → --apply
-- 기존 min_spec·recommended_spec·storage_gb는 그대로 둔다 (spec_parsed는 그 텍스트를 풀어 둔 결과)

-- spec_parsed 모양(v4): {"v":4, "min":{cpu,gpu,ram_gb,storage_gb,matched,low_spec,confidence,detail}, "rec":{…} | null}
--   cpu·gpu는 제조사별 등급 {"nvidia":9,"amd":11,"intel":6} (대안 표기를 합치지 않음), 읽지 못하면 null, 모델·VRAM·DirectX 같은 사양 단어가 없는 표기는 {"any":1}(low_spec: true)
--   세대 없이 급만 적은 CPU는 짐작하지 않고 등급표의 "(세대 미표기)" 기본값, 모바일 CPU·GPU는 데스크톱보다 한 단계 낮게 (v4부터. v3까지는 출시 3년 전 세대로 짐작해 cpu_generation_guessed 칸이 있었음)
--   v1~v3는 v4 적용 뒤 저장돼 있지 않다 (버전이 오르면 parse-specs가 전체를 한 번 다시 처리)
alter table public.games add column if not exists spec_parsed jsonb;
-- spec_hash: 파싱에 쓴 사양 텍스트(min_spec + recommended_spec)의 SHA-1 앞 16자 — 같으면 다시 처리하지 않고, 텍스트가 바뀌면 다시 처리
alter table public.games add column if not exists spec_hash text;

-- API가 새 칸을 바로 알아보게 스키마 캐시 새로고침
notify pgrst, 'reload schema';
