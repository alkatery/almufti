/* ============ المواد ============
   صفحة واحدة (index.html) لكل المواد؛ المادة تُحدَّد بالمعامل ?s=<id> (الافتراضي: imla).
   لإضافة مادة: أضف مدخلًا هنا وملف بياناتها data/<id>.js، ويُضاف رمزها إلى results_subject_chk في Supabase.
   يُحمَّل هذا الملف في آخر <body>: يضبط نصوص المادة فورًا ثم يحمّل بياناتها و app.js بالترتيب. */
const SUBJECTS = {
  imla: { name:'الإملاء',      title:'تمارين الموطّأ في الإملاء', pageTitle:'اختبارات الموطأ في الإملاء',
          units:'الأبواب', unit:'الباب', unitBare:'باب', unitIndef:'بابًا' },
  sarf: { name:'الصرف الصغير', title:'تمارين الصرف الصغير',       pageTitle:'اختبارات الصرف الصغير',
          units:'الأقسام', unit:'القسم', unitBare:'قسم', unitIndef:'قسمًا' }
};
const DEFAULT_SUBJECT = 'imla';   // السجلات القديمة بلا حقل subject تعود إلى الإملاء أيضًا
const SUBJECT_ID = (()=>{
  let s = '';
  try{ s = (new URLSearchParams(location.search).get('s') || '').trim().toLowerCase(); }catch(e){}
  return Object.prototype.hasOwnProperty.call(SUBJECTS, s) ? s : DEFAULT_SUBJECT;
})();

(function(){
  const S = SUBJECTS[SUBJECT_ID];
  document.title = S.pageTitle;
  document.querySelectorAll('[data-subj]').forEach(el=>{
    const v = S[el.getAttribute('data-subj')];
    if(typeof v === 'string') el.textContent = v;
  });

  // نسخة الملفات تُؤخذ من رابط هذا الملف (?v=) لتجاوز ذاكرة المتصفّح المؤقتة بعد كل تحديث
  let ver = '';
  try{ ver = new URL(document.currentScript.src).searchParams.get('v') || ''; }catch(e){}
  const q = ver ? '?v='+encodeURIComponent(ver) : '';

  const fail = src=>{
    const box = document.createElement('div');
    box.setAttribute('role','alert');
    box.style.cssText = 'position:fixed;inset:auto 16px 16px;background:#F8E9E7;color:#8f2c24;border:1px solid #EBC9C4;border-radius:11px;padding:12px 16px;font-family:Tajawal,sans-serif;z-index:200;text-align:center';
    box.textContent = 'تعذّر تحميل ملفات الاختبار ('+src+'). تحقّق من الاتصال ثم أعد تحميل الصفحة.';
    document.body.appendChild(box);
    console.error('فشل تحميل', src);
  };
  // async=false يضمن تنفيذ البيانات قبل app.js مع تنزيلهما بالتوازي
  ['data/'+SUBJECT_ID+'.js', 'assets/app.js'].forEach(src=>{
    const el = document.createElement('script');
    el.src = src + q; el.async = false;
    el.onerror = ()=>fail(src);
    document.body.appendChild(el);
  });
})();
