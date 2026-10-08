-- 5장(과학적 기법에 의한 오염원인 추정)은 module_rows에 module_number = 8로 저장하는데,
-- module_rows_module_number_check 제약이 0~7만 허용해서 저장이 전부 거부되고 있었다.
-- 8까지 허용하도록 제약을 바꾼다. Supabase SQL Editor에서 실행하세요.

alter table module_rows drop constraint if exists module_rows_module_number_check;
alter table module_rows
  add constraint module_rows_module_number_check
  check (module_number between 0 and 8);
