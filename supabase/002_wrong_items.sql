-- =====================================================================
--  إضافة تفاصيل الإجابات الخاطئة لتحليل «أصعب الأسئلة» في لوحة المعلّم
--  نفِّذه بعد security.sql من: SQL Editor → New query → Run (آمن لإعادة التنفيذ)
--
--  wrong_items: مواضع الأسئلة الخاطئة أو المتروكة (تبدأ من 0) داخل الباب/القسم
--  كما وردت في data/<subject>.js. لا تُعِد ترتيب الأسئلة في ملفات البيانات بعد
--  جمع النتائج، وإلا اختلط التحليل (الإضافة في آخر الباب آمنة).
-- =====================================================================

alter table public.results add column if not exists wrong_items smallint[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'results_wrong_items_chk') then
    alter table public.results add constraint results_wrong_items_chk check (
      wrong_items is null
      or (
        cardinality(wrong_items) = wrong
        and array_position(wrong_items, null) is null
        and 0 <= all (wrong_items)
        and 200 > all (wrong_items)
      )
    ) not valid;
  end if;
end $$;

-- صلاحيات الإدراج في security.sql محدّدة بالأعمدة، فيلزم منح العمود الجديد صراحةً
grant insert (wrong_items) on public.results to anon, authenticated;
