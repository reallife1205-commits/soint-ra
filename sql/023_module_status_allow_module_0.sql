-- 1. 개요는 module_status에 module_number = 0으로 완료 기록을 남기는데,
-- 어느 안건에도 0번 기록이 하나도 없다 — 번호 제약이 1~7만 허용해서 저장이 거부되는 것으로 보인다.
-- (안건 등록 시 0~7번을 한꺼번에 넣는 것도 0번 때문에 통째로 실패해서, 완료 처리한 번호만 행이 있다.)
-- 0~7까지 허용하도록 제약을 바꾼다. Supabase SQL Editor에서 실행하세요.

alter table module_status drop constraint if exists module_status_module_number_check;
alter table module_status
  add constraint module_status_module_number_check
  check (module_number between 0 and 7);
