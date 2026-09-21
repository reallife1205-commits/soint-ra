-- 연도별로 "배정받은 전체 안건 수"를 기록해서, 실제로 토담에 등록한 건수와 비교할 수 있게 함.
-- Supabase SQL Editor에서 실행하세요.

create table if not exists year_case_targets (
  year int primary key,
  total_assigned int not null default 0,
  updated_at timestamptz not null default now()
);

alter table year_case_targets enable row level security;

drop policy if exists "year_case_targets_allow_all" on year_case_targets;
create policy "year_case_targets_allow_all"
  on year_case_targets
  for all
  using (true)
  with check (true);
