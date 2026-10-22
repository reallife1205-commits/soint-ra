-- 2장은 2.1·2.2를 따로 완료(·잠금)한다. 하위 항목 완료는 module_number = 키×10(2.1 → 21, 2.2 → 22).
-- 장 완료(12)는 그대로 쓰되, 화면이 2.1·2.2가 모두 완료일 때만 켠다(장 완료 개수 세는 곳은 손대지 않음).
-- 3장도 나중에 나눌 수 있게 31~36도 미리 허용해 둔다.
-- Supabase SQL Editor에서 한 번에 실행하세요.

-- 1) 번호 제약: 옛 0~7 + 장 11~16 + 하위 항목 21~29, 31~39
alter table module_status drop constraint if exists module_status_module_number_check;
alter table module_status
  add constraint module_status_module_number_check
  check (
    module_number between 0 and 7
    or module_number between 11 and 16
    or module_number between 21 and 29
    or module_number between 31 and 39
  );

-- 2) 이미 2장을 완료한 안건은 2.1·2.2도 완료로 옮긴다
insert into module_status (case_id, module_number, module_name, is_completed, completed_at)
select m.case_id, s.num, s.name, true, coalesce(m.completed_at, now())
from module_status m
cross join (values
  (21, '2.1 대상부지 토양오염 현황'),
  (22, '2.2 인접·주변부지 토양오염 현황')
) as s(num, name)
where m.module_number = 12
  and m.is_completed
  and not exists (
    select 1 from module_status x where x.case_id = m.case_id and x.module_number = s.num
  );
