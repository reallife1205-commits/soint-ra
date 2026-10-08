-- 완료 처리를 장(1~6) 단위로 바꾼다. 장 완료는 module_number = 10 + 장 번호(11~16)로 기록.
-- 옛 0~7 기록은 지우지 않고 그대로 둔다(화면에서는 더 이상 세지 않음).
-- Supabase SQL Editor에서 한 번에 실행하세요.

-- 1) 번호 제약: 옛 0~7 + 장 11~16 허용
alter table module_status drop constraint if exists module_status_module_number_check;
alter table module_status
  add constraint module_status_module_number_check
  check (module_number between 0 and 7 or module_number between 11 and 16);

-- 2) 기존 완료 기록을 장 기준으로 옮김 (각 장에서 실제로 완료 버튼이 있던 옛 번호 기준)
--    1장 ← 0(안건 개요) / 2장 ← 1, 2(대상·주변부지) 둘 다 / 3장 ← 3(소유 이력) / 4장 ← 6(현장조사)
--    5장 ← 예전엔 완료 버튼이 없었으므로 미완료 / 6장 ← 7(오염 개연성 판단)
with done as (
  select case_id, array_agg(module_number) as nums
  from module_status
  where is_completed and module_number between 0 and 7
  group by case_id
),
chapters as (
  select c.id as case_id, ch.num, ch.name,
    case ch.num
      when 11 then coalesce(d.nums @> array[0], false)
      when 12 then coalesce(d.nums @> array[1, 2], false)
      when 13 then coalesce(d.nums @> array[3], false)
      when 14 then coalesce(d.nums @> array[6], false)
      when 15 then false
      when 16 then coalesce(d.nums @> array[7], false)
    end as is_completed
  from cases c
  cross join (values
    (11, '1. 개요'),
    (12, '2. 토양오염물질의 종류·양·특성'),
    (13, '3. 기술검토 결과'),
    (14, '4. 현장 및 청취조사'),
    (15, '5. 과학적 기법에 의한 오염원인 추정'),
    (16, '6. 기술검토 결과(종합)')
  ) as ch(num, name)
  left join done d on d.case_id = c.id
)
insert into module_status (case_id, module_number, module_name, is_completed, completed_at)
select case_id, num, name, is_completed, case when is_completed then now() end
from chapters ch
where not exists (
  select 1 from module_status m where m.case_id = ch.case_id and m.module_number = ch.num
);
