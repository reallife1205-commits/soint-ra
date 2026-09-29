-- 공지사항 전체에 적용할 글자색/크기 저장용 컬럼 추가.
-- Supabase SQL Editor에서 실행하세요.

alter table announcements add column if not exists color text;
alter table announcements add column if not exists font_size int;
