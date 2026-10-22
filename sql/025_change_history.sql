-- 입력 내용 변경 이력(되돌리기용).
-- 화면의 칸은 포커스가 벗어나면 바로 DB에 덮어써서, 실수로 고친 숫자의 원래 값을 알 길이 없었다.
-- 아래 테이블이 바뀔 때마다(추가·수정·삭제) 바뀌기 전/후 내용을 change_history에 자동으로 남긴다.
-- 화면에서는 각 장 제목 옆 "변경 이력" 버튼으로 보고, 원하는 시점의 값으로 되돌린다.
-- Supabase SQL Editor에서 한 번에 실행하세요.

create table if not exists change_history (
  id bigserial primary key,
  case_id uuid,                -- cases는 지워져도 이력은 남기려고 FK를 걸지 않음
  table_name text not null,
  row_id uuid not null,
  module_number int,           -- module_rows일 때만
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,              -- 바뀌기 전 행 전체 (insert면 null)
  new_data jsonb,              -- 바뀐 뒤 행 전체 (delete면 null)
  changed_at timestamptz not null default now()
);

create index if not exists idx_change_history_case on change_history(case_id, changed_at desc);
create index if not exists idx_change_history_row on change_history(table_name, row_id, changed_at desc);

alter table change_history enable row level security;

drop policy if exists "change_history_allow_all" on change_history;
create policy "change_history_allow_all"
  on change_history
  for all
  using (true)
  with check (true);

create or replace function log_change_history() returns trigger
language plpgsql as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
begin
  -- updated_at만 바뀐 저장(내용은 그대로)은 남기지 않는다
  if tg_op = 'UPDATE' and (o - 'updated_at') = (n - 'updated_at') then
    return null;
  end if;

  insert into change_history (case_id, table_name, row_id, module_number, action, old_data, new_data)
  values (
    case when tg_table_name = 'cases' then (r->>'id')::uuid else (r->>'case_id')::uuid end,
    tg_table_name,
    (r->>'id')::uuid,
    (r->>'module_number')::int,
    lower(tg_op),
    o,
    n
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'module_rows', 'cases', 'field_surveys', 'pollution_mappings',
    'surrounding_impacts', 'review_opinions'
  ] loop
    execute format('drop trigger if exists trg_change_history on %I', t);
    execute format(
      'create trigger trg_change_history after insert or update or delete on %I
         for each row execute function log_change_history()', t);
  end loop;
end $$;
