-- 안건(cases)에 부지 경계선 저장용 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

alter table cases
  add column if not exists boundary_points jsonb;

alter table inventory_sites
  add column if not exists boundary_points jsonb;
