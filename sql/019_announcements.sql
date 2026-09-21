-- 메인화면 상단(배너 바로 아래)에 띄우는 공지사항 — 항상 한 줄(id=1)만 유지하는 싱글턴 테이블.
-- Supabase SQL Editor에서 실행하세요.

create table if not exists announcements (
  id int primary key default 1,
  content text not null default '',
  updated_at timestamptz not null default now(),
  constraint announcements_single_row check (id = 1)
);

insert into announcements (id, content)
values (1, '')
on conflict (id) do nothing;

alter table announcements enable row level security;

drop policy if exists "announcements_allow_all" on announcements;
create policy "announcements_allow_all"
  on announcements
  for all
  using (true)
  with check (true);
