/* ============ إعدادات لوحة المختبِرين ============
   لتفعيل التجميع من كل الأجهزة: املأ url و key من مشروع Supabase.
   إن تُركا فارغين، تُحفظ النتائج محليًّا على هذا الجهاز فقط (وضع مؤقّت للمعاينة). */
const CLOUD = {
  url:   'https://torkltmgjndodxwtaexn.supabase.co',
  key:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcmtsdG1nam5kb2R4d3RhZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTk0MzQsImV4cCI6MjA5Njk5NTQzNH0.Xr2uh-Xid4RmuseI03aWARpyjrMvCnirffSnWpcwiDw',
  table: 'results'
};
// مفتاح anon علنيّ بطبيعته: لا يكفي وحده إلا للإدراج. قراءة اللوحة تتطلّب
// تسجيل دخول معلّم عبر Supabase Auth، وتحكمها سياسات RLS في supabase/security.sql
const CLOUD_ON = () => !!(CLOUD.url && CLOUD.key);
const CLOUD_BASE = () => CLOUD.url.replace(/\/+$/,'');

/* ============ المادة ============
   SUBJECTS و SUBJECT_ID و DEFAULT_SUBJECT معرّفة في assets/subjects.js، والبيانات في data/<id>.js */
const SUBJECT_KEY = SUBJECT_ID;
const SUBJECT = SUBJECTS[SUBJECT_KEY];
const rowSubject = r => (r && r.subject && SUBJECTS[r.subject]) ? r.subject : DEFAULT_SUBJECT;
const subjectName = id => (SUBJECTS[id]||{}).name || id;

const logoImg = new Image(); logoImg.src = 'assets/logo.png';

/* ============ أدوات ============ */
const $ = s => document.querySelector(s);
const shuffle = a => { const r=a.slice(); for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
const showScreen = id => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); $(id).classList.add('active'); window.scrollTo({top:0,behavior:'auto'}); };
const arDigits = s => String(s).replace(/[0-9]/g, d=>'٠١٢٣٤٥٦٧٨٩'[d]);

/* ============ الحالة ============ */
const TF_TYPE = 'صواب أو خطأ';
const PASS_PCT = 60;
// mode: 'full' اختبار كامل يُحفظ ويمنح شهادة | 'retry' مراجعة الأخطاء (تدريب لا يُحفظ)
const state = { name:'', email:'', chapter:-1, questions:[], answers:[], cur:0, mode:'full' };

/* ============ بناء شبكة الأبواب ============ */
function buildChapters(){
  const box = $('#chapters');
  EXAM_DATA.forEach((ch,i)=>{
    const el = document.createElement('button');
    el.className='chapter'; el.type='button'; el.dataset.i=i; el.setAttribute('aria-pressed','false');
    el.innerHTML = `<span class="check">✓</span>
      <div class="idx">${arDigits(i+1)}</div>
      <div class="ttl">${ch.title}</div>
      <div class="meta">
        <span class="pill">${arDigits(ch.questions.length)} سؤالًا</span>
      </div>`;
    el.addEventListener('click',()=>selectChapter(i));
    box.appendChild(el);
  });
}
function selectChapter(i){
  state.chapter = i;
  document.querySelectorAll('.chapter').forEach(c=>{
    const on = +c.dataset.i===i; c.classList.toggle('sel',on); c.setAttribute('aria-pressed',on);
  });
  $('#err-chapter').classList.remove('show');
}

/* ============ التحقق والبدء ============ */
function validate(){
  let ok=true;
  const name=$('#in-name').value.trim();
  const email=$('#in-email').value.trim();
  if(!name){ $('#in-name').classList.add('invalid'); $('#err-name').classList.add('show'); ok=false; }
  else { $('#in-name').classList.remove('invalid'); $('#err-name').classList.remove('show'); }
  const re=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(!re.test(email)){ $('#in-email').classList.add('invalid'); $('#err-email').classList.add('show'); ok=false; }
  else { $('#in-email').classList.remove('invalid'); $('#err-email').classList.remove('show'); }
  if(state.chapter<0){ $('#err-chapter').classList.add('show'); ok=false; }
  return ok;
}
// qi: موضع السؤال في ملف البيانات — مفتاح ثابت لتحليل الأسئلة ولاستئناف الاختبار
function makeQuestion(chIdx, qi, optionOrder){
  const q = EXAM_DATA[chIdx].questions[qi];
  // صواب/خطأ يبقى بترتيبه الأصلي؛ الاختيار من متعدد تُخلط خياراته
  const options = optionOrder || (q.type===TF_TYPE ? q.options.slice() : shuffle(q.options));
  return { qi, q:q.q, type:q.type, level:q.level, page:q.page, options, correct:q.correct };
}
function beginExam(questions, mode, answers, cur){
  state.mode = mode;
  state.questions = questions;
  state.answers = answers || new Array(questions.length).fill(null);
  state.cur = cur || 0;
  const title = EXAM_DATA[state.chapter].title;
  $('#exam-title').textContent = mode==='retry' ? 'مراجعة الأخطاء — '+title : title;
  $('#q-total').textContent = arDigits(questions.length);
  buildPalette();
  renderQuestion();
  showScreen('#screen-exam');
  saveProgress();
}
function startExam(){
  if(!validate()) return;
  state.name=$('#in-name').value.trim();
  state.email=$('#in-email').value.trim();
  const ch=EXAM_DATA[state.chapter];
  const qs = shuffle(ch.questions.map((_,qi)=>qi)).map(qi=>makeQuestion(state.chapter, qi));
  beginExam(qs, 'full');
}
function startRetryWrong(){
  const wrong = state.questions.filter((q,i)=>state.answers[i]!==q.correct);
  if(!wrong.length) return;
  beginExam(shuffle(wrong).map(q=>makeQuestion(state.chapter, q.qi)), 'retry');
}

/* ============ حفظ التقدّم واستئنافه (على جهاز الطالب فقط) ============ */
const PROGRESS_KEY = 'almufti_progress_'+SUBJECT_KEY;
const PROGRESS_TTL = 7*24*3600*1000;
function saveProgress(){
  try{
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      v:1, ts:Date.now(), name:state.name, email:state.email, chapter:state.chapter, mode:state.mode,
      chapterTitle:EXAM_DATA[state.chapter].title,
      items:state.questions.map(q=>({ qi:q.qi, o:q.options })), answers:state.answers, cur:state.cur
    }));
  }catch(e){}
}
function clearProgress(){ try{ localStorage.removeItem(PROGRESS_KEY); }catch(e){} }
// يعيد بناء الاختبار المحفوظ، ويرفضه إن تغيّرت البيانات منذ حفظه
function readProgress(){
  let p; try{ p=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null'); }catch(e){ p=null; }
  if(!p || p.v!==1 || !Array.isArray(p.items) || !p.items.length) return null;
  const ch = EXAM_DATA[p.chapter];
  if(Date.now()-p.ts > PROGRESS_TTL || !ch || ch.title!==p.chapterTitle){ clearProgress(); return null; }
  const qs=[];
  for(const it of p.items){
    const src = ch.questions[it.qi];
    if(!src || !Array.isArray(it.o) || it.o.length!==src.options.length || !it.o.every(o=>src.options.includes(o))){ clearProgress(); return null; }
    qs.push(makeQuestion(p.chapter, it.qi, it.o.slice()));
  }
  const answers = (Array.isArray(p.answers) && p.answers.length===qs.length)
    ? p.answers.map((a,i)=> qs[i].options.includes(a) ? a : null) : new Array(qs.length).fill(null);
  return { p, qs, answers, cur: Math.min(Math.max(+p.cur||0,0), qs.length-1) };
}
function showResumeBox(){
  const r = readProgress(), box=$('#resume-box');
  if(!r){ box.style.display='none'; return; }
  const done = r.answers.filter(a=>a!==null).length;
  $('#resume-text').textContent = (r.p.mode==='retry'?'مراجعة الأخطاء — ':'')+r.p.chapterTitle
    +' · أُجيب عن '+arDigits(done)+' من '+arDigits(r.qs.length);
  box.style.display='block';
}
function resumeExam(){
  const r = readProgress(); if(!r){ showResumeBox(); return; }
  state.name=r.p.name||''; state.email=r.p.email||''; state.chapter=r.p.chapter;
  $('#in-name').value=state.name; $('#in-email').value=state.email;
  beginExam(r.qs, r.p.mode==='retry'?'retry':'full', r.answers, r.cur);
}
function discardProgress(){ clearProgress(); showResumeBox(); }

/* ============ لوحة الأسئلة ============ */
function buildPalette(){
  const g=$('#palette-grid'); g.innerHTML='';
  state.questions.forEach((_,i)=>{
    const b=document.createElement('button');
    b.className='pnum'; b.type='button'; b.textContent=arDigits(i+1);
    b.addEventListener('click',()=>{ $('#palette').classList.remove('open'); goTo(i); });
    g.appendChild(b);
  });
}
function refreshPalette(){
  document.querySelectorAll('.pnum').forEach((b,i)=>{
    b.classList.toggle('done', state.answers[i]!==null);
    b.classList.toggle('cur', i===state.cur);
  });
}

/* ============ عرض السؤال ============ */
function renderQuestion(){
  const i=state.cur, q=state.questions[i];
  const card=$('#q-card');
  let html = `<div class="q-head">
      <span class="q-badge type">${escapeHTML(q.type)}</span>
      ${q.level?`<span class="q-badge level">المستوى: ${escapeHTML(q.level)}</span>`:''}
    </div>
    <div class="q-text">${escapeHTML(q.q)}</div>
    <div class="options" role="radiogroup" aria-label="خيارات الإجابة">`;
  q.options.forEach((opt,oi)=>{
    const sel = state.answers[i]===opt ? 'sel':'';
    const checked = sel? 'true':'false';
    html += `<button class="opt ${sel}" type="button" role="radio" aria-checked="${checked}" data-opt="${oi}">
        <span class="mark"></span><span class="txt">${escapeHTML(opt)}</span>
      </button>`;
  });
  html += `</div>`;
  card.innerHTML=html;
  card.querySelectorAll('.opt').forEach(btn=>{
    btn.addEventListener('click',()=>selectOption(+btn.dataset.opt));
  });
  // أزرار التنقل
  $('#btn-prev').style.visibility = i===0 ? 'hidden':'visible';
  const last = i===state.questions.length-1;
  $('#btn-next').innerHTML = last
    ? 'إنهاء الاختبار <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
    : 'التالي <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>';
  $('#btn-next').classList.toggle('btn-pink', last);
  $('#btn-next').classList.toggle('btn-primary', !last);
  $('#q-cur').textContent=arDigits(i+1);
  updateProgress(); refreshPalette();
}
function selectOption(oi){
  const q=state.questions[state.cur];
  if(!q || oi<0 || oi>=q.options.length) return;
  state.answers[state.cur] = q.options[oi];
  renderQuestion(); updateProgress(); saveProgress();
  // إعادة الرسم تحذف الزر المركَّز عليه؛ نعيد التركيز إلى الخيار المختار
  const b=$('#q-card .opt[data-opt="'+oi+'"]'); if(b) b.focus({preventScroll:true});
}
// بعد التنقّل بين الأسئلة: نقل التركيز إلى بطاقة السؤال لقارئات الشاشة ولوحة المفاتيح
function goTo(i){
  if(i<0 || i>=state.questions.length) return;
  state.cur=i; renderQuestion(); saveProgress();
  $('#q-card').focus({preventScroll:true});
}
function updateProgress(){
  const done = state.answers.filter(a=>a!==null).length;
  $('#q-done').textContent=arDigits(done);
  $('#pbar-fill').style.width = (done/state.questions.length*100)+'%';
  refreshPalette();
}
function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* ============ التنقل والإنهاء ============ */
$('#btn-prev').addEventListener('click',()=>goTo(state.cur-1));
$('#btn-next').addEventListener('click',()=>{
  if(state.cur < state.questions.length-1) goTo(state.cur+1);
  else tryFinish();
});

/* ============ اختصارات لوحة المفاتيح (شاشة الاختبار) ============
   ١–٩ أو 1–9: اختيار الخيار | ص/خ: صواب/خطأ | ←: التالي | →: السابق (اتجاه RTL)
   Enter: التالي أو الإنهاء | Esc: إغلاق نافذة التأكيد */
const AR_DIGITS='١٢٣٤٥٦٧٨٩';
document.addEventListener('keydown',e=>{
  if(!$('#screen-exam').classList.contains('active')) return;
  if(e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if($('#modal-finish').classList.contains('open')){
    if(e.key==='Escape'){ e.preventDefault(); $('#modal-finish').classList.remove('open'); }
    return;
  }
  const t=e.target;
  if(t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  const q=state.questions[state.cur]; if(!q) return;
  let n = /^[1-9]$/.test(e.key) ? +e.key : (AR_DIGITS.indexOf(e.key)+1);
  if(!n && q.type===TF_TYPE){
    const idx = e.key==='ص' ? q.options.indexOf('صواب') : e.key==='خ' ? q.options.indexOf('خطأ') : -1;
    if(idx>=0) n=idx+1;
  }
  if(n){ if(n<=q.options.length){ e.preventDefault(); selectOption(n-1); } return; }
  if(e.key==='ArrowLeft'){ e.preventDefault(); $('#btn-next').click(); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); goTo(state.cur-1); }
  // Enter على زرّ مركَّز يُفعّله المتصفّح أصلًا؛ نتعامل معه فقط خارج الأزرار
  else if(e.key==='Enter' && !(t && t.closest && t.closest('button'))){ e.preventDefault(); $('#btn-next').click(); }
});
function tryFinish(){
  const un = state.answers.filter(a=>a===null).length;
  $('#modal-msg').textContent = un>0
    ? `لديك ${arDigits(un)} سؤالًا دون إجابة (تُحتسب خاطئة). أتريد الإنهاء وعرض النتيجة؟`
    : 'أجبت عن جميع الأسئلة. أتريد عرض النتيجة؟';
  $('#modal-finish').classList.add('open');
}
$('#modal-cancel').addEventListener('click',()=>$('#modal-finish').classList.remove('open'));
$('#modal-confirm').addEventListener('click',()=>{ $('#modal-finish').classList.remove('open'); finishExam(); });

/* ============ النتيجة ============ */
let RESULT={};
function finishExam(){
  let correct=0;
  state.questions.forEach((q,i)=>{ if(state.answers[i]===q.correct) correct++; });
  const total=state.questions.length;
  const wrong=total-correct;
  const pct=Math.round(correct/total*100);
  const passed = pct>=PASS_PCT;
  const grade = pct>=90?'ممتاز': pct>=80?'جيّد جدًّا': pct>=70?'جيّد': pct>=PASS_PCT?'مقبول':'لم يجتز';
  const wrongItems = state.questions.filter((q,i)=>state.answers[i]!==q.correct).map(q=>q.qi).sort((a,b)=>a-b);
  const retry = state.mode==='retry';
  RESULT={ name:state.name, email:state.email, chapter:EXAM_DATA[state.chapter].title, correct,wrong,total,pct,passed,grade, wrong_items:wrongItems, mode:state.mode };
  clearProgress();
  if(!retry) saveAttempt(RESULT);   // جولة مراجعة الأخطاء تدريب لا يدخل في الإحصاء

  $('#result-chapter').textContent = (retry?'مراجعة الأخطاء — ':'')+RESULT.chapter;
  $('#res-name').textContent = state.name;
  $('#res-msg-pre').textContent = retry ? (wrong? 'واصل المراجعة يا ' : 'أتقنت أخطاءك يا ')
                                : passed ? 'أحسنت يا ' : 'لم تبلغ درجة الاجتياز يا ';
  $('#res-msg-post').textContent = retry ? '— هذه جولة تدريب لا تُسجَّل ولا تمنح شهادة.'
                                 : passed ? '' : '— الحدّ الأدنى '+arDigits(PASS_PCT)+'٪. راجع أخطاءك ثم أعد المحاولة.';
  // الشهادة لمن اجتاز الاختبار الكامل فقط
  $('#btn-cert').style.display = (passed && !retry) ? '' : 'none';
  const rb=$('#btn-retry-wrong');
  rb.style.display = wrong>0 ? '' : 'none';
  $('#retry-count').textContent = arDigits(wrong);
  $('#st-correct').textContent=arDigits(correct);
  $('#st-wrong').textContent=arDigits(wrong);
  $('#st-total').textContent=arDigits(total);
  $('#res-pct').textContent=arDigits(pct)+'%';
  const tag=$('#res-grade'); tag.textContent=grade;
  tag.className='grade-tag '+(passed?'grade-pass':'grade-fail');

  // مؤشر دائري
  const r=86, circ=2*Math.PI*r;
  const fill=$('#gauge-fill');
  fill.style.stroke = passed? 'var(--correct)':'var(--wrong)';
  fill.style.strokeDasharray=circ;
  fill.style.strokeDashoffset=circ;
  buildReview();
  showScreen('#screen-result');
  requestAnimationFrame(()=>{ setTimeout(()=>{ fill.style.strokeDashoffset = circ*(1-pct/100); },120); });
}
function buildReview(){
  const box=$('#review'); box.innerHTML='';
  state.questions.forEach((q,i)=>{
    const ua=state.answers[i];
    const right = ua===q.correct;
    const rev=document.createElement('div');
    rev.className='rev '+(right?'correct':'wrong');
    let opts='';
    q.options.forEach(opt=>{
      let cls='n', tag='';
      if(opt===q.correct){ cls='c'; tag='الإجابة الصحيحة'; }
      else if(opt===ua){ cls='w'; tag='إجابتك'; }
      opts += `<div class="rev-opt ${cls}">${tag?`<span class="tag">${tag}</span>`:''}${escapeHTML(opt)}</div>`;
    });
    if(ua===null) opts += `<div class="rev-opt w"><span class="tag">إجابتك</span>لم تُجب</div>`;
    rev.innerHTML = `<div class="rev-q"><span class="ic">${right?'✓':'✕'}</span>
        <span><span class="qn">${arDigits(i+1)}.</span>${escapeHTML(q.q)}${q.page?`<span class="rev-page">المرجع: ص ${arDigits(q.page)}</span>`:''}</span></div>
      <div class="rev-opts">${opts}</div>`;
    box.appendChild(rev);
  });
}

/* ============ الشهادة (Canvas → PNG بدقّة طباعة A4 تقريبًا) ============ */
const CERT = {
  W:1400, H:990, S:2.5,                 // 3500×2475 بكسل ≈ A4 أفقي بدقّة 300dpi
  paper:'#FBF7EC', paperEdge:'#EFE6D2',
  teal:'#0E6E5E', tealDeep:'#0A3F36',
  gold:'#B08D4C', goldLight:'#D9BE84', goldDeep:'#7A5E2C',
  ink:'#2A3632', inkSoft:'#5B6862',
  stamp:'#8E1C3B',                       // حبر الختم (عنابي)
  issuer:'المفتي اللغوي', motto:'لبث الوعي اللغوي'
};
async function ensureFonts(){
  if(!(document.fonts && document.fonts.load)) return;
  try{ await Promise.all([
    document.fonts.load('700 70px "Aref Ruqaa"'),
    document.fonts.load('400 30px "Aref Ruqaa"'),
    document.fonts.load('600 16px "Reem Kufi"'),
    document.fonts.load('700 40px Amiri'),
    document.fonts.load('400 26px Amiri'),
    document.fonts.load('700 22px Tajawal'),
    document.fonts.load('500 22px Tajawal'),
    document.fonts.ready
  ]); }catch(e){}
}
function hijriDate(d){
  try{ return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric'}).format(d).replace(/\s*هـ$/,'')+' هـ'; }
  catch(e){ return ''; }
}
function hijriYear(d){
  try{ return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{year:'numeric'}).format(d).replace(/\s*هـ$/,''); }
  catch(e){ return ''; }
}
function gregDate(d){
  try{ return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric'}).format(d)+' م'; }
  catch(e){ return d.toLocaleDateString('ar'); }
}
// مولّد عشوائي ثابت البذرة: يجعل ملمس الختم ثابتًا للشهادة نفسها
function seededRandom(seed){
  let a = seed>>>0;
  return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function certRef(R, now){
  const h = hashStr([R.name,R.email,R.chapter,R.pct,now.toISOString()].join('|')).toString(36).toUpperCase().padStart(7,'0').slice(-7);
  return 'MF-'+SUBJECT_KEY.toUpperCase()+'-'+h;
}
function goldGradient(ctx,x0,x1){
  const g=ctx.createLinearGradient(x0,0,x1,0);
  g.addColorStop(0,CERT.goldDeep); g.addColorStop(.28,CERT.goldLight); g.addColorStop(.5,CERT.gold);
  g.addColorStop(.72,CERT.goldLight); g.addColorStop(1,CERT.goldDeep);
  return g;
}
// نجمة ثمانية (خاتم سليمان): مربّعان متداخلان
function star8Path(ctx,cx,cy,r){
  ctx.beginPath();
  for(let i=0;i<16;i++){
    const a=-Math.PI/2+i*Math.PI/8, rr = i%2? r*0.76 : r;
    const x=cx+rr*Math.cos(a), y=cy+rr*Math.sin(a);
    i? ctx.lineTo(x,y) : ctx.moveTo(x,y);
  }
  ctx.closePath();
}
function rosette(ctx,cx,cy,r){
  ctx.save();
  ctx.fillStyle=CERT.paper; ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.fill();
  ctx.strokeStyle=goldGradient(ctx,cx-r,cx+r); ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.stroke();
  ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,r-5,0,2*Math.PI); ctx.stroke();
  ctx.lineWidth=1.6; star8Path(ctx,cx,cy,r-9); ctx.stroke();
  ctx.fillStyle=CERT.teal; star8Path(ctx,cx,cy,(r-9)*0.42); ctx.fill();
  ctx.restore();
}
// زخرفة هندسية خفيفة كعلامة مائية داخل الإطار
function drawPattern(ctx,x,y,w,h){
  ctx.save();
  ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.strokeStyle='rgba(176,141,76,0.07)'; ctx.lineWidth=1;
  const step=56;
  for(let yy=y-step; yy<y+h+step; yy+=step){
    for(let xx=x-step; xx<x+w+step; xx+=step){
      const off = (Math.round((yy-y)/step)%2) ? step/2 : 0;
      star8Path(ctx,xx+off,yy,18); ctx.stroke();
    }
  }
  ctx.restore();
}
// إطار: شريط داكن، خط ذهبي، شريط زخرفي من معيّنات، ثم خط ذهبي مزدوج وزوايا وردية
function drawFrame(ctx){
  const {W,H}=CERT;
  ctx.save();
  ctx.fillStyle=CERT.tealDeep;
  ctx.fillRect(0,0,W,22); ctx.fillRect(0,H-22,W,22); ctx.fillRect(0,0,22,H); ctx.fillRect(W-22,0,22,H);
  ctx.strokeStyle=goldGradient(ctx,0,W); ctx.lineWidth=2.4; ctx.strokeRect(28,28,W-56,H-56);
  ctx.lineWidth=1; ctx.strokeRect(34,34,W-68,H-68);
  // شريط المعيّنات
  ctx.fillStyle='rgba(176,141,76,0.55)';
  const band=46, gap=26;
  const diamond=(x,y,s)=>{ ctx.beginPath(); ctx.moveTo(x,y-s); ctx.lineTo(x+s,y); ctx.lineTo(x,y+s); ctx.lineTo(x-s,y); ctx.closePath(); ctx.fill(); };
  for(let x=110; x<=W-110; x+=gap){ diamond(x,band,3.2); diamond(x,H-band,3.2); }
  for(let y=110; y<=H-110; y+=gap){ diamond(band,y,3.2); diamond(W-band,y,3.2); }
  ctx.strokeStyle=goldGradient(ctx,0,W); ctx.lineWidth=1.8; ctx.strokeRect(58,58,W-116,H-116);
  ctx.lineWidth=0.8; ctx.strokeRect(64,64,W-128,H-128);
  ctx.restore();
  [[60,60],[W-60,60],[60,H-60],[W-60,H-60]].forEach(([x,y])=>rosette(ctx,x,y,30));
}
function ornamentDivider(ctx,cx,y,half){
  ctx.save();
  const g=ctx.createLinearGradient(cx-half,0,cx+half,0);
  g.addColorStop(0,'rgba(176,141,76,0)'); g.addColorStop(.5,CERT.gold); g.addColorStop(1,'rgba(176,141,76,0)');
  ctx.strokeStyle=g; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(cx-half,y); ctx.lineTo(cx-14,y); ctx.moveTo(cx+14,y); ctx.lineTo(cx+half,y); ctx.stroke();
  ctx.fillStyle=CERT.gold;
  ctx.beginPath(); ctx.moveTo(cx,y-8); ctx.lineTo(cx+8,y); ctx.lineTo(cx,y+8); ctx.lineTo(cx-8,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle=CERT.paper; ctx.beginPath(); ctx.arc(cx,y,2.4,0,2*Math.PI); ctx.fill();
  [-26,26].forEach(dx=>{ ctx.fillStyle=CERT.gold; ctx.beginPath(); ctx.arc(cx+dx,y,2.2,0,2*Math.PI); ctx.fill(); });
  ctx.restore();
}
// يصغّر الخط حتى يتّسع النص للعرض المتاح
function fitFont(ctx,text,weight,size,family,maxW,minSize){
  let s=size; ctx.font=`${weight} ${s}px ${family}`;
  while(ctx.measureText(text).width>maxW && s>minSize){ s-=2; ctx.font=`${weight} ${s}px ${family}`; }
  return s;
}
function wrapLines(ctx,text,maxW){
  const words=text.split(' '), lines=[]; let line='';
  for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW && line){ lines.push(line); line=w; } else line=t; }
  if(line) lines.push(line);
  return lines;
}
/* نص عربي على قوس دون كسر اتصال الحروف: يُرسم النص مستقيمًا على لوح جانبي
   ثم يُنقل شرائح رأسية رفيعة على محيط الدائرة. top=true أعلى الختم (يُقرأ من الخارج)،
   وfalse أسفله (يُقرأ معتدلًا من الداخل). */
function arcText(ctx,text,font,color,cx,cy,R,top,S){
  const m=document.createElement('canvas').getContext('2d'); m.font=font;
  const tw=Math.ceil(m.measureText(text).width)+4, th=Math.ceil(parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1])*1.7);
  const off=document.createElement('canvas'); off.width=Math.ceil(tw*S); off.height=Math.ceil(th*S);
  const o=off.getContext('2d'); o.scale(S,S); o.font=font; o.fillStyle=color;
  o.textAlign='center'; o.textBaseline='middle'; o.direction='rtl'; o.fillText(text,tw/2,th/2);
  const span=tw/R, cols=off.width, dw=1.6/S;
  for(let k=0;k<cols;k++){
    const x=k/S;
    const th0 = top ? (-Math.PI/2 - span/2 + x/R) : (Math.PI/2 + span/2 - x/R);
    ctx.save();
    ctx.translate(cx+R*Math.cos(th0), cy+R*Math.sin(th0));
    ctx.rotate(top ? th0+Math.PI/2 : th0-Math.PI/2);
    ctx.drawImage(off,k,0,1,off.height,-dw/2,-th/2,dw,th);
    ctx.restore();
  }
}
/* ختم مطاطي بحبر عنابي: حلقتان، نص دائري، نجمة ثمانية، «معتمد» والسنة الهجرية،
   ثم ملمس حبر (نقاط فارغة، ضغط غير متساوٍ، انتشار خفيف) ودوران بسيط كالختم اليدوي. */
function drawStamp(ctx,cx,cy,R,seed,year){
  const S=CERT.S, pad=10, size=(R+pad)*2;
  const off=document.createElement('canvas'); off.width=Math.ceil(size*S); off.height=Math.ceil(size*S);
  const o=off.getContext('2d'); o.scale(S,S);
  const c=size/2, ink=CERT.stamp;
  o.strokeStyle=ink; o.fillStyle=ink;
  o.shadowColor='rgba(142,28,59,0.45)'; o.shadowBlur=1.2;   // انتشار الحبر
  o.lineWidth=4;   o.beginPath(); o.arc(c,c,R,0,2*Math.PI); o.stroke();
  o.lineWidth=1.3; o.beginPath(); o.arc(c,c,R-7,0,2*Math.PI); o.stroke();
  o.lineWidth=1.6; o.beginPath(); o.arc(c,c,R-31,0,2*Math.PI); o.stroke();
  // حلقة نقاط
  for(let i=0;i<60;i++){ const a=i*Math.PI/30; o.beginPath(); o.arc(c+(R-35)*Math.cos(a), c+(R-35)*Math.sin(a), .9,0,2*Math.PI); o.fill(); }
  o.shadowBlur=0.6;
  arcText(o, CERT.issuer, '700 17px "Reem Kufi", Tajawal, sans-serif', ink, c,c,R-19, true,  S);
  arcText(o, CERT.motto,  '600 14px "Reem Kufi", Tajawal, sans-serif', ink, c,c,R-19, false, S);
  // نجمتان صغيرتان على الجانبين
  [0,Math.PI].forEach(a=>{ star8Path(o, c+(R-19)*Math.cos(a), c+(R-19)*Math.sin(a), 5); o.fill(); });
  // المركز
  o.lineWidth=1.4; star8Path(o,c,c,R-41); o.stroke();
  o.textAlign='center'; o.direction='rtl';
  o.font='700 25px "Aref Ruqaa", Amiri, serif'; o.textBaseline='middle'; o.fillText('معتمد',c,c-5);
  o.font='700 11.5px Tajawal, sans-serif'; o.fillText(year? year+' هـ' : '', c, c+19);

  // ملمس الحبر
  const rnd=seededRandom(seed);
  o.shadowBlur=0; o.globalCompositeOperation='destination-out';
  const speck=(r0,alpha,rad)=>{ const a=rnd()*2*Math.PI, r=Math.sqrt(rnd())*r0;
    o.fillStyle=`rgba(0,0,0,${alpha.toFixed(3)})`; o.beginPath(); o.arc(c+r*Math.cos(a), c+r*Math.sin(a), rad, 0, 2*Math.PI); o.fill(); };
  for(let i=0;i<700;i++)  speck(R+2, rnd()*0.6, rnd()*0.7+0.15);        // مسام دقيقة
  for(let i=0;i<34;i++)   speck(R,   0.12+rnd()*0.3, 2+rnd()*6);        // بقع حبر ناقص
  for(let i=0;i<160;i++){ const a=rnd()*2*Math.PI, r=R-2+rnd()*4;       // تآكل الحافة الخارجية
    o.fillStyle=`rgba(0,0,0,${(0.3+rnd()*0.6).toFixed(2)})`; o.beginPath(); o.arc(c+r*Math.cos(a), c+r*Math.sin(a), 0.6+rnd()*1.6, 0, 2*Math.PI); o.fill(); }
  for(let i=0;i<7;i++){   // خدوش رفيعة
    o.strokeStyle=`rgba(0,0,0,${(0.15+rnd()*0.25).toFixed(2)})`; o.lineWidth=0.5+rnd()*0.8;
    const a=rnd()*2*Math.PI, l=20+rnd()*45, x=c+(rnd()-.5)*R*1.4, y=c+(rnd()-.5)*R*1.4;
    o.beginPath(); o.moveTo(x,y); o.lineTo(x+l*Math.cos(a), y+l*Math.sin(a)); o.stroke();
  }
  const pa=rnd()*2*Math.PI;   // ضغط غير متساوٍ: جهة أفتح من الأخرى
  const pg=o.createLinearGradient(c+R*Math.cos(pa),c+R*Math.sin(pa),c-R*Math.cos(pa),c-R*Math.sin(pa));
  pg.addColorStop(0,'rgba(0,0,0,0.45)'); pg.addColorStop(.55,'rgba(0,0,0,0.05)'); pg.addColorStop(1,'rgba(0,0,0,0)');
  o.fillStyle=pg; o.fillRect(0,0,size,size);
  o.globalCompositeOperation='source-over';

  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(-0.16 + (rnd()-.5)*0.06);
  ctx.globalAlpha=0.86; ctx.globalCompositeOperation='multiply';
  ctx.drawImage(off,-size/2,-size/2,size,size);
  ctx.restore();
}
function infoBlock(ctx,x,y,label,lines){
  ctx.save();
  const g=ctx.createLinearGradient(x-120,0,x+120,0);
  g.addColorStop(0,'rgba(176,141,76,0)'); g.addColorStop(.5,CERT.gold); g.addColorStop(1,'rgba(176,141,76,0)');
  ctx.strokeStyle=g; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x-120,y); ctx.lineTo(x+120,y); ctx.stroke();
  ctx.textAlign='center'; ctx.direction='rtl';
  ctx.fillStyle=CERT.goldDeep; ctx.font='700 16px Tajawal, sans-serif'; ctx.fillText(label,x,y+28);
  lines.forEach((l,i)=>{ ctx.fillStyle=i? CERT.inkSoft : CERT.ink; ctx.font=(i?'500 15px':'500 18px')+' Tajawal, sans-serif'; ctx.fillText(l,x,y+56+i*24); });
  ctx.restore();
}
async function generateCertificate(){
  if(!RESULT.passed || RESULT.mode==='retry') return;
  const btn=$('#btn-cert'); btn.disabled=true;
  try{
    await ensureFonts();
    const {W,H,S}=CERT, cx=W/2, now=new Date();
    const cv=$('#cert-canvas'); cv.width=W*S; cv.height=H*S;
    const ctx=cv.getContext('2d'); ctx.setTransform(S,0,0,S,0,0);
    ctx.textAlign='center'; ctx.direction='rtl'; ctx.textBaseline='alphabetic';

    // الورق: لون كريمي مع تعتيم خفيف للأطراف
    ctx.fillStyle=CERT.paper; ctx.fillRect(0,0,W,H);
    const v=ctx.createRadialGradient(cx,H/2,H*0.25,cx,H/2,W*0.75);
    v.addColorStop(0,'rgba(255,255,255,0.55)'); v.addColorStop(1,'rgba(214,196,156,0.35)');
    ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
    drawPattern(ctx,66,66,W-132,H-132);
    drawFrame(ctx);

    // الشعار
    if(logoImg && !logoImg.complete){ await new Promise(r=>{logoImg.onload=r; logoImg.onerror=r;}); }
    try{ if(logoImg && logoImg.naturalWidth){ const lw=104, lh=lw*logoImg.naturalHeight/logoImg.naturalWidth; ctx.drawImage(logoImg, cx-lw/2, 86, lw, lh); } }catch(e){}

    // العنوان
    const tg=ctx.createLinearGradient(cx-210,0,cx+210,0);
    tg.addColorStop(0,'#6B5122'); tg.addColorStop(.35,'#A9853F'); tg.addColorStop(.5,'#8A6A2E'); tg.addColorStop(.65,'#A9853F'); tg.addColorStop(1,'#6B5122');
    ctx.fillStyle=tg;
    ctx.font='700 66px "Aref Ruqaa", Amiri, serif';
    ctx.fillText('شهادة إتمام',cx,266);
    ctx.fillStyle=CERT.teal; ctx.font='400 25px Amiri, serif';
    ctx.fillText(SUBJECT.title,cx,306);
    ornamentDivider(ctx,cx,332,230);

    // المستفيد — صياغة محايدة تصلح للذكر والأنثى
    ctx.fillStyle=CERT.inkSoft; ctx.font='500 21px Tajawal, sans-serif';
    ctx.fillText('تُمنح هذه الشهادة إلى',cx,380);
    fitFont(ctx,RESULT.name,700,68,'"Aref Ruqaa", Amiri, serif',820,36);
    ctx.fillStyle=CERT.tealDeep; ctx.fillText(RESULT.name,cx,460);
    ornamentDivider(ctx,cx,490,300);

    ctx.fillStyle=CERT.inkSoft; ctx.font='500 21px Tajawal, sans-serif';
    ctx.fillText('تقديرًا لإتمام اختبار',cx,536);
    ctx.fillStyle=CERT.ink; ctx.font='700 31px Amiri, serif';
    const chLines=wrapLines(ctx,RESULT.chapter,960).slice(0,2);
    chLines.forEach((l,i)=>ctx.fillText(l,cx,578+i*40));
    const extra=(chLines.length-1)*40;

    // النتيجة: ثلاث خانات بإطار ذهبي رفيع
    const by=612+extra, bw=600, bh=84, bx=cx-bw/2;
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.6)'; roundRect(ctx,bx,by,bw,bh,12); ctx.fill();
    ctx.strokeStyle=CERT.gold; ctx.lineWidth=1.3; roundRect(ctx,bx,by,bw,bh,12); ctx.stroke();
    ctx.strokeStyle='rgba(176,141,76,0.45)'; ctx.lineWidth=1;
    [bx+bw/3,bx+2*bw/3].forEach(x=>{ ctx.beginPath(); ctx.moveTo(x,by+14); ctx.lineTo(x,by+bh-14); ctx.stroke(); });
    const cells=[['التقدير',RESULT.grade],['النسبة',arDigits(RESULT.pct)+'٪'],['الدرجة',arDigits(RESULT.correct)+' من '+arDigits(RESULT.total)]];
    cells.forEach(([l,val],i)=>{
      const x=bx+bw - (i+0.5)*bw/3;   // من اليمين إلى اليسار
      ctx.fillStyle=CERT.goldDeep; ctx.font='700 15px Tajawal, sans-serif'; ctx.fillText(l,x,by+30);
      ctx.fillStyle=CERT.teal; ctx.font='700 30px Amiri, serif'; ctx.fillText(val,x,by+67);
    });
    ctx.restore();

    // التذييل: التاريخ يمينًا، الختم وسطًا، جهة الإصدار والرقم المرجعي يسارًا
    const fy=Math.max(790, by+bh+64);
    const ref=certRef(RESULT,now);
    const hd=hijriDate(now), gd=gregDate(now);
    infoBlock(ctx, W-330, fy, 'تاريخ الإصدار', hd? [hd,gd] : [gd]);
    infoBlock(ctx, 330, fy, 'جهة الإصدار', [CERT.issuer+' — '+CERT.motto, 'الرقم المرجعي: '+ref]);
    drawStamp(ctx, cx, fy+30, 84, hashStr(ref), hijriYear(now));

    // تنزيل
    const safe=(RESULT.name+' - '+RESULT.chapter).replace(/[\\/:*?"<>|]/g,'').slice(0,80);
    const blob = await new Promise(r=>cv.toBlob(r,'image/png'));
    const a=document.createElement('a');
    a.download='شهادة '+safe+'.png';
    a.href = blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png');
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ a.remove(); if(blob) URL.revokeObjectURL(a.href); },4000);
  }catch(e){
    console.error('تعذّر إنشاء الشهادة', e);
    alert('تعذّر إنشاء الشهادة. أعد المحاولة.');
  }finally{ btn.disabled=false; }
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

/* ============ إعادة ============ */
function restart(){
  state.chapter=-1; state.mode='full';
  showResumeBox();
  document.querySelectorAll('.chapter').forEach(c=>{c.classList.remove('sel');c.setAttribute('aria-pressed','false')});
  showScreen('#screen-start');
}

/* ============ تخزين النتائج + لوحة المختبِرين ============ */
function recFromResult(R){
  return {
    subject:SUBJECT_KEY,
    name:R.name||'', email:R.email||'', chapter:R.chapter||'',
    correct:R.correct, wrong:R.wrong, total:R.total,
    pct:R.pct, grade:R.grade||'', passed:!!R.passed,
    wrong_items:Array.isArray(R.wrong_items)? R.wrong_items : null,
    created_at:new Date().toISOString()
  };
}
async function saveAttempt(R){
  const rec = recFromResult(R);
  // الوضع المحلي فقط: لا نترك بيانات الطلاب على أجهزة مشتركة حين تكون السحابة مفعّلة
  if(!CLOUD_ON()){
    try{
      const a = JSON.parse(localStorage.getItem('almufti_results')||'[]');
      a.push(rec); localStorage.setItem('almufti_results', JSON.stringify(a));
    }catch(e){}
    return;
  }
  {
    const post = body => fetch(CLOUD_BASE()+'/rest/v1/'+CLOUD.table, {
      method:'POST',
      headers:{ 'apikey':CLOUD.key, 'Authorization':'Bearer '+CLOUD.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
      body: JSON.stringify(body)
    });
    // أعمدة اختيارية: إن لم تُضف بعد إلى الجدول تُحذف من السجل ويُعاد الإرسال كي لا تضيع النتيجة
    const OPTIONAL = ['subject','wrong_items'];
    let body = { ...rec };
    try{
      for(let attempt=0; attempt<=OPTIONAL.length; attempt++){
        const res = await post(body);
        if(res.ok) return;
        const txt = await res.text().catch(()=> '');
        const m = res.status===400 && /column/i.test(txt) && OPTIONAL.find(c=>c in body && txt.includes(c));
        if(!m){ console.warn('لم تُحفظ النتيجة في السحابة: HTTP '+res.status, txt); return; }
        console.warn('عمود '+m+' غير موجود في جدول results — أُعيد الإرسال بدونه.');
        delete body[m];
      }
    }catch(e){ console.warn('تعذّر الاتصال بالسحابة لحفظ النتيجة', e); }
  }
}

/* ============ جلسة المعلّم (Supabase Auth) ============ */
const AUTH_KEY = 'almufti_teacher_session';
function getSession(){ try{ return JSON.parse(sessionStorage.getItem(AUTH_KEY)||'null'); }catch(e){ return null; } }
function setSession(d){
  const s = { access_token:d.access_token, refresh_token:d.refresh_token,
              expires_at: Date.now() + ((+d.expires_in||3600)*1000), email:(d.user&&d.user.email)||'' };
  try{ sessionStorage.setItem(AUTH_KEY, JSON.stringify(s)); }catch(e){}
  return s;
}
function clearSession(){ try{ sessionStorage.removeItem(AUTH_KEY); }catch(e){} }
async function authRequest(grant, body){
  const res = await fetch(CLOUD_BASE()+'/auth/v1/token?grant_type='+grant, {
    method:'POST', headers:{ 'apikey':CLOUD.key, 'Content-Type':'application/json' }, body:JSON.stringify(body)
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok || !data.access_token){
    const e = new Error(data.error_description || data.msg || data.error || ('HTTP '+res.status));
    e.status = res.status; throw e;
  }
  return setSession(data);
}
async function validSession(){
  const s = getSession();
  if(!s || !s.access_token) return null;
  if(Date.now() < s.expires_at - 60000) return s;
  if(!s.refresh_token){ clearSession(); return null; }
  try{ return await authRequest('refresh_token', { refresh_token:s.refresh_token }); }
  catch(e){ clearSession(); return null; }
}
async function loadAttempts(){
  if(CLOUD_ON()){
    const s = await validSession();
    if(!s){ const e=new Error('انتهت الجلسة'); e.auth=true; throw e; }
    // Supabase يقصّ الاستجابة عند حدّ max-rows (الافتراضي 1000)، فنجلب الصفحات تباعًا
    const PAGE=1000, MAX=50000, all=[];
    for(let off=0; off<MAX; off+=PAGE){
      const res = await fetch(CLOUD_BASE()+'/rest/v1/'+CLOUD.table+'?select=*&order=created_at.desc&limit='+PAGE+'&offset='+off, {
        headers:{ 'apikey':CLOUD.key, 'Authorization':'Bearer '+s.access_token }
      });
      if(res.status===401 || res.status===403){ clearSession(); const e=new Error('HTTP '+res.status); e.auth=true; throw e; }
      if(!res.ok) throw new Error('HTTP '+res.status);
      const chunk = await res.json();
      all.push(...chunk);
      if(chunk.length < PAGE) return all;
    }
    all.truncated = true;   // بلغ الحدّ الأعلى للعرض
    return all;
  }
  try{ return JSON.parse(localStorage.getItem('almufti_results')||'[]').slice().reverse(); }catch(e){ return []; }
}
function fmtDate(iso){
  try{ return new Intl.DateTimeFormat('ar-EG',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)); }
  catch(e){ return iso||''; }
}
let STATS_DATA=[];
function showGate(msg){
  $('#stats-gate').style.display='block'; $('#stats-body').style.display='none';
  $('#gate-pass').value='';
  const err=$('#gate-err'); err.textContent=msg||''; err.classList.toggle('show', !!msg);
  setTimeout(()=>($('#gate-email').value? $('#gate-pass') : $('#gate-email')).focus(),60);
}
function showStatsBody(){
  $('#stats-gate').style.display='none'; $('#stats-body').style.display='block';
  const s=getSession(); $('#stats-logout').style.display = (CLOUD_ON() && s)? '' : 'none';
  loadAndRender();
}
async function openStats(){
  showScreen('#screen-stats');
  // الوضع المحلي: البيانات على هذا الجهاز فقط ولا يوجد خادم للمصادقة
  if(!CLOUD_ON() || await validSession()) showStatsBody();
  else showGate();
}
let unlocking=false;
async function statsUnlock(){
  if(unlocking) return;
  const email=$('#gate-email').value.trim(), password=$('#gate-pass').value;
  const err=$('#gate-err');
  if(!email || !password){ err.textContent='أدخل البريد وكلمة المرور.'; err.classList.add('show'); return; }
  unlocking=true; const btn=$('#gate-unlock'); btn.disabled=true; btn.textContent='…جارٍ الدخول';
  try{
    await authRequest('password', { email, password });
    showStatsBody();
  }catch(e){
    err.textContent = (e.status===400 || e.status===401) ? 'البريد أو كلمة المرور غير صحيحة.'
                    : (e.status===429) ? 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة.'
                    : 'تعذّر الاتصال بالخادم ('+e.message+').';
    err.classList.add('show');
  }finally{ unlocking=false; btn.disabled=false; btn.textContent='دخول'; }
}
async function statsLogout(){
  const s=getSession(); clearSession(); STATS_DATA=[];
  $('#dash-tbody').innerHTML=''; $('#kpi-grid').innerHTML=''; $('#chapter-bars').innerHTML='';
  if(s && s.access_token){
    fetch(CLOUD_BASE()+'/auth/v1/logout', { method:'POST', headers:{ 'apikey':CLOUD.key, 'Authorization':'Bearer '+s.access_token } }).catch(()=>{});
  }
  showGate();
}
async function loadAndRender(){
  const note=$('#stats-note'); note.textContent='…جارٍ التحميل'; note.classList.remove('err');
  try{
    STATS_DATA = await loadAttempts();
    const chip=$('#conn-chip');
    chip.textContent = CLOUD_ON()? 'متصل بالسحابة' : 'محلي (هذا الجهاز فقط)';
    chip.className = 'chip '+(CLOUD_ON()?'chip-ok':'chip-warn');
    buildSubjectFilter(); buildChapterFilter(); renderStats();
    note.textContent = STATS_DATA.truncated ? 'تُعرض أحدث '+arDigits(STATS_DATA.length)+' محاولة فقط.' : '';
  }catch(e){
    if(e.auth){ showGate('انتهت الجلسة أو لا يملك هذا الحساب صلاحية القراءة. سجّل الدخول مجددًا.'); return; }
    note.textContent='تعذّر التحميل من السحابة ('+e.message+') — راجع url/key والصلاحيات.';
    note.classList.add('err');
  }
}
function currentRows(){
  const q=($('#stats-search').value||'').trim().toLowerCase();
  const ch=$('#stats-chapter').value;
  const sb=$('#stats-subject').value;
  return STATS_DATA.filter(r=>{
    if(sb && rowSubject(r)!==sb) return false;
    if(ch && (r.chapter||'')!==ch) return false;
    if(q && !(((r.name||'')+' '+(r.email||'')).toLowerCase().includes(q))) return false;
    return true;
  });
}
function buildSubjectFilter(){
  const sel=$('#stats-subject');
  if(sel.options.length) return;
  sel.innerHTML='<option value="">كل المواد</option>'+Object.keys(SUBJECTS).map(id=>`<option value="${id}">${escapeHTML(SUBJECTS[id].name)}</option>`).join('');
  sel.value=SUBJECT_KEY;
}
function buildChapterFilter(){
  const sel=$('#stats-chapter'), cur=sel.value, sb=$('#stats-subject').value;
  const chs=[...new Set(STATS_DATA.filter(r=>!sb||rowSubject(r)===sb).map(r=>r.chapter||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  const all = sb ? 'كل '+SUBJECTS[sb].units : 'كل الأبواب والأقسام';
  sel.innerHTML=`<option value="">${all}</option>`+chs.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  sel.value = chs.includes(cur) ? cur : '';
}
function renderStats(){
  const rows=currentRows(), n=rows.length;
  const testers=new Set(rows.map(r=>(r.email||r.name||'').trim().toLowerCase()).filter(Boolean)).size;
  const avg=n?Math.round(rows.reduce((s,r)=>s+(+r.pct||0),0)/n):0;
  const passN=rows.filter(r=>r.passed||(+r.pct>=60)).length;
  const passRate=n?Math.round(passN/n*100):0;
  const hi=n?Math.max(...rows.map(r=>+r.pct||0)):0;
  const lo=n?Math.min(...rows.map(r=>+r.pct||0)):0;
  const kpis=[['عدد المحاولات',arDigits(n)],['عدد المختبِرين',arDigits(testers)],['متوسّط النسبة',arDigits(avg)+'%'],['نسبة النجاح',arDigits(passRate)+'%'],['أعلى نتيجة',arDigits(hi)+'%'],['أدنى نتيجة',arDigits(lo)+'%']];
  $('#kpi-grid').innerHTML=kpis.map(k=>`<div class="kpi"><div class="kpi-n">${k[1]}</div><div class="kpi-l">${k[0]}</div></div>`).join('');
  const byCh={}, allSubj=!$('#stats-subject').value;
  rows.forEach(r=>{ const c=(allSubj? subjectName(rowSubject(r))+' — ' : '')+(r.chapter||'—'); (byCh[c]=byCh[c]||[]).push(+r.pct||0); });
  const chArr=Object.keys(byCh).map(c=>({c,n:byCh[c].length,avg:Math.round(byCh[c].reduce((s,x)=>s+x,0)/byCh[c].length)})).sort((a,b)=>b.n-a.n);
  $('#chapter-bars').innerHTML = chArr.length? chArr.map(o=>`<div class="bar-row"><div class="bar-lbl" title="${escapeHTML(o.c)}">${escapeHTML(o.c)}</div><div class="bar-track"><i style="width:${o.avg}%"></i></div><div class="bar-val">${arDigits(o.avg)}% · ${arDigits(o.n)} محاولة</div></div>`).join('') : '<div class="muted-row">لا توجد بيانات بعد.</div>';
  const tb=$('#dash-tbody');
  tb.innerHTML = rows.length? rows.map((r,i)=>`<tr><td>${arDigits(i+1)}</td><td>${escapeHTML(r.name||'')}</td><td dir="ltr" style="text-align:right">${escapeHTML(r.email||'')}</td><td class="nowrap">${escapeHTML(subjectName(rowSubject(r)))}</td><td>${escapeHTML(r.chapter||'')}</td><td class="nowrap">${arDigits(r.correct||0)}/${arDigits(r.total||0)}</td><td><b style="color:${(+r.pct>=60)?'var(--correct)':'var(--wrong)'}">${arDigits(+r.pct||0)}%</b></td><td>${escapeHTML(r.grade||'')}</td><td class="nowrap">${fmtDate(r.created_at)}</td></tr>`).join('') : '<tr><td colspan="9" class="muted-row">لا توجد نتائج بعد.</td></tr>';
  $('#rows-count').textContent=arDigits(rows.length);
  renderHardest(rows);
}
/* تحليل الأسئلة: نسبة الخطأ لكل سؤال من المحاولات التي تحمل wrong_items.
   يعتمد على موضع السؤال في ملف البيانات، فلا يُعاد ترتيب الأسئلة في data/*.js بعد جمع النتائج. */
function renderHardest(rows){
  const box=$('#hardest'), note=$('#hardest-note');
  const sb=$('#stats-subject').value;
  if(sb && sb!==SUBJECT_KEY){
    box.innerHTML=''; note.textContent='تحليل الأسئلة متاح لمادة هذه الصفحة فقط ('+SUBJECT.name+'). افتح صفحة المادة الأخرى لعرض تحليلها.'; return;
  }
  const chIdx={}; EXAM_DATA.forEach((c,i)=>chIdx[c.title]=i);
  const attempts={}, wrongs={};
  rows.forEach(r=>{
    if(rowSubject(r)!==SUBJECT_KEY || !Array.isArray(r.wrong_items)) return;
    const ci=chIdx[r.chapter]; if(ci===undefined) return;
    attempts[ci]=(attempts[ci]||0)+1;
    new Set(r.wrong_items).forEach(qi=>{ if(EXAM_DATA[ci].questions[qi]){ const k=ci+':'+qi; wrongs[k]=(wrongs[k]||0)+1; } });
  });
  const list=Object.keys(wrongs).map(k=>{
    const [ci,qi]=k.split(':').map(Number), n=attempts[ci], w=wrongs[k];
    return { ci, qi, n, w, rate:Math.round(w/n*100), q:EXAM_DATA[ci].questions[qi] };
  }).sort((a,b)=> b.rate-a.rate || b.w-a.w).slice(0,20);
  const total=Object.values(attempts).reduce((s,x)=>s+x,0);
  if(!list.length){
    box.innerHTML='';
    note.textContent = total ? 'لا أخطاء مسجّلة في المحاولات المعروضة.' : 'لا توجد بيانات تفصيلية بعد — تُجمع من المحاولات الجديدة فقط.';
    return;
  }
  note.textContent='مرتّبة بنسبة الخطأ (أعلى '+arDigits(list.length)+') · عدد المحاولات المسجّلة بالتفاصيل: '+arDigits(total);
  box.innerHTML = `<div class="table-scroll"><table class="dash-table"><thead><tr><th>نسبة الخطأ</th><th>السؤال</th><th>${escapeHTML(SUBJECT.unit)}</th><th>المستوى</th><th>أخطأ/حاول</th></tr></thead><tbody>`+
    list.map(o=>`<tr><td><b style="color:${o.rate>=50?'var(--wrong)':'var(--gold-deep)'}">${arDigits(o.rate)}%</b></td><td>${escapeHTML(o.q.q)}<div class="hq-ans">الصحيح: ${escapeHTML(o.q.correct)}${o.q.page?' · ص '+arDigits(o.q.page):''}</div></td><td>${escapeHTML(EXAM_DATA[o.ci].title)}</td><td class="nowrap">${escapeHTML(o.q.level||'')}</td><td class="nowrap">${arDigits(o.w)}/${arDigits(o.n)}</td></tr>`).join('')+
    '</tbody></table></div>';
}
function exportCSV(){
  const rows=currentRows();
  const head=['الاسم','البريد','المادة','الباب/القسم','صحيح','خطأ','المجموع','النسبة','التقدير','اجتاز','التاريخ','أرقام الأسئلة الخاطئة (حسب ملف البيانات)'];
  const esc=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
  const lines=[head.join(',')].concat(rows.map(r=>[r.name,r.email,subjectName(rowSubject(r)),r.chapter,r.correct,r.wrong,r.total,r.pct,r.grade,(r.passed||+r.pct>=60)?'نعم':'لا',fmtDate(r.created_at),Array.isArray(r.wrong_items)?r.wrong_items.map(x=>x+1).join(' '):''].map(esc).join(',')));
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='بيانات-المختبرين.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

/* ============ ربط الأحداث ============ */
$('#btn-start').addEventListener('click',startExam);
$('#btn-cert').addEventListener('click',generateCertificate);
$('#btn-restart').addEventListener('click',restart);
$('#btn-retry-wrong').addEventListener('click',startRetryWrong);
$('#resume-go').addEventListener('click',resumeExam);
$('#resume-drop').addEventListener('click',discardProgress);
$('#palette-toggle').addEventListener('click',()=>$('#palette').classList.toggle('open'));
$('#btn-open-stats').addEventListener('click',openStats);
$('#gate-unlock').addEventListener('click',statsUnlock);
$('#stats-logout').addEventListener('click',statsLogout);
['gate-email','gate-pass'].forEach(id=>{
  $('#'+id).addEventListener('keydown',e=>{ if(e.key==='Enter') statsUnlock(); });
  $('#'+id).addEventListener('input',()=>$('#gate-err').classList.remove('show'));
});
['stats-back','stats-back2'].forEach(id=>{ const el=$('#'+id); if(el) el.addEventListener('click',()=>showScreen('#screen-start')); });
$('#stats-refresh').addEventListener('click',loadAndRender);
$('#stats-export').addEventListener('click',exportCSV);
$('#stats-search').addEventListener('input',renderStats);
$('#stats-chapter').addEventListener('change',renderStats);
$('#stats-subject').addEventListener('change',()=>{ buildChapterFilter(); renderStats(); });
['in-name','in-email'].forEach(id=>$('#'+id).addEventListener('input',()=>{
  $('#'+id).classList.remove('invalid'); $('#err-'+id.split('-')[1]).classList.remove('show');
}));

buildChapters();
showResumeBox();
