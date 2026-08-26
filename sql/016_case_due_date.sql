-- 안건 마감일(D-day 기준일) 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

alter table cases add column if not exists due_date date;
