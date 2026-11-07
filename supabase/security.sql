-- =====================================================================
--  تأمين جدول النتائج (results) في Supabase
--  نفِّذه مرة واحدة من: Supabase Dashboard → SQL Editor → New query → Run
--  الملف آمن لإعادة التنفيذ (idempotent).
--
--  النتيجة بعد التنفيذ:
--   • الزائر (anon) يستطيع الإدراج فقط، ولا يستطيع القراءة أو التعديل أو الحذف.
--   • القراءة مقصورة على حسابات المعلّمين المسجّلة في جدول teachers.
--   • كل سجل يُفحص على الخادم: اتساق الأرقام، المادة، التقدير، الأطوال.
--   • created_at يضعه الخادم لا المتصفّح.
--   • حدّ للطلبات: لكل بريد، ولإجمالي الإدراج في الدقيقة.
-- =====================================================================

-- ---------- 1) أعمدة لازمة (لا تغيّر الموجود) ----------
alter table public.results add column if not exists subject text;
alter table public.results alter column created_at set default now();

-- ---------- 2) قيود سلامة البيانات ----------
-- NOT VALID: تُطبَّق على كل إدراج جديد دون أن تفشل بسبب سجلات قديمة.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'results_counts_chk') then
    alter table public.results add constraint results_counts_chk check (
      total between 1 and 200
      and correct between 0 and total
      and wrong = total - correct
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'results_pct_chk') then
    alter table public.results add constraint results_pct_chk check (
      pct = round(correct * 100.0 / total)
      and passed = (pct >= 60)
      and grade = case
        when pct >= 90 then 'ممتاز'
        when pct >= 80 then 'جيّد جدًّا'
        when pct >= 70 then 'جيّد'
        when pct >= 60 then 'مقبول'
        else 'لم يجتز'
      end
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'results_subject_chk') then
    alter table public.results add constraint results_subject_chk check (
      subject is null or subject in ('imla', 'sarf')
    ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'results_text_chk') then
    alter table public.results add constraint results_text_chk check (
      char_length(btrim(name)) between 1 and 120
      and char_length(email) between 3 and 254
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      and char_length(chapter) between 1 and 300
    ) not valid;
  end if;
end $$;

-- ---------- 3) حدّ الطلبات + ختم الوقت من الخادم ----------
create index if not exists results_email_created_idx on public.results (lower(email), created_at desc);
create index if not exists results_created_idx       on public.results (created_at desc);

create or replace function public.results_before_insert()
returns trigger
language plpgsql
security definer          -- يعدّ السجلات رغم أن anon لا يملك صلاحية القراءة
set search_path = public
as $$
declare
  per_email int;
  global_n  int;
begin
  new.created_at := now();
  new.email      := lower(btrim(new.email));
  new.name       := btrim(new.name);

  select count(*) into per_email
    from public.results
   where lower(email) = new.email
     and created_at > now() - interval '10 minutes';
  if per_email >= 15 then
    raise exception 'rate_limited: too many attempts for this email' using errcode = 'P0001';
  end if;

  select count(*) into global_n
    from public.results
   where created_at > now() - interval '1 minute';
  if global_n >= 120 then
    raise exception 'rate_limited: global insert limit' using errcode = 'P0001';
  end if;

  return new;
end $$;

revoke all on function public.results_before_insert() from public, anon, authenticated;

drop trigger if exists results_before_insert on public.results;
create trigger results_before_insert
  before insert on public.results
  for each row execute function public.results_before_insert();

-- ---------- 4) جدول المعلّمين المخوَّلين بالقراءة ----------
create table if not exists public.teachers (
  email text primary key check (email = lower(email))
);
alter table public.teachers enable row level security;   -- بلا سياسات = لا وصول من الواجهة
revoke all on public.teachers from anon, authenticated;

-- أضف بريد كل معلّم هنا (بأحرف صغيرة)، ثم أنشئ له حسابًا في Authentication → Users:
-- insert into public.teachers (email) values ('teacher@example.com') on conflict do nothing;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers
     where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;

-- ---------- 5) صلاحيات الجدول + RLS ----------
alter table public.results enable row level security;
alter table public.results force row level security;

-- حذف كل السياسات السابقة على results (ومنها أي سياسة كانت تسمح لـ anon بالقراءة)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'results' loop
    execute format('drop policy %I on public.results', p.policyname);
  end loop;
end $$;

revoke all on public.results from anon, authenticated;
grant insert (subject, name, email, chapter, correct, wrong, total, pct, grade, passed, created_at)
  on public.results to anon, authenticated;
grant select on public.results to authenticated;

-- تسلسل المفتاح الأساسي (إن كان id من نوع serial/identity)
do $$
declare s text;
begin
  select pg_get_serial_sequence('public.results', 'id') into s;
  if s is not null then
    execute format('grant usage on sequence %s to anon, authenticated', s);
  end if;
exception when undefined_column then null;
end $$;

create policy results_insert_public on public.results
  for insert to anon, authenticated
  with check (true);                 -- السلامة مضمونة بالقيود والمشغّل أعلاه

create policy results_select_teachers on public.results
  for select to authenticated
  using (public.is_teacher());

-- ---------- 6) تحقّق سريع بعد التنفيذ ----------
-- select policyname, cmd, roles from pg_policies where tablename = 'results';
