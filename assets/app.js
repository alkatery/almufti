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

/* ============ الشهادة (Canvas → PNG) ============ */
async function ensureFonts(){
  if(document.fonts && document.fonts.load){
    try{ await Promise.all([
      document.fonts.load('700 60px Amiri'),
      document.fonts.load('400 30px Amiri'),
      document.fonts.load('700 30px Tajawal'),
      document.fonts.load('500 26px Tajawal'),
      document.fonts.ready
    ]); }catch(e){}
  }
}
function hijriDate(d){
  try{ return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric'}).format(d)+'هـ'; }
  catch(e){ return ''; }
}
function gregDate(d){
  try{ return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric'}).format(d)+'م'; }
  catch(e){ return d.toLocaleDateString('ar'); }
}
function drawRosette(ctx,cx,cy,R,color){
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=2.4; ctx.fillStyle=color;
  ctx.beginPath(); ctx.arc(cx,cy,R,0,2*Math.PI); ctx.stroke();
  for(const rot of [0,Math.PI/4]){
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
    const s=R*0.86; ctx.strokeRect(-s/2,-s/2,s,s); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(cx,cy,R*0.42,0,2*Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,R*0.14,0,2*Math.PI); ctx.fill();
  ctx.restore();
}
async function generateCertificate(){
  if(!RESULT.passed || RESULT.mode==='retry') return;
  await ensureFonts();
  const S=2, W=1400, H=990;
  const cv=$('#cert-canvas'); cv.width=W*S; cv.height=H*S;
  const ctx=cv.getContext('2d'); ctx.scale(S,S);
  ctx.textAlign='center'; ctx.direction='rtl';
  const cx=W/2;

  // خلفية
  ctx.fillStyle='#FBF7EE'; ctx.fillRect(0,0,W,H);
  const g=ctx.createRadialGradient(cx,H*0.4,80,cx,H*0.4,W*0.7);
  g.addColorStop(0,'rgba(154,123,66,0.05)'); g.addColorStop(1,'rgba(14,110,94,0.04)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // إطار مزدوج
  ctx.strokeStyle='#9A7B42'; ctx.lineWidth=4; ctx.strokeRect(34,34,W-68,H-68);
  ctx.strokeStyle='#C2A368'; ctx.lineWidth=1.5; ctx.strokeRect(48,48,W-96,H-96);
  const corner=(x,y,sx,sy)=>{ ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.strokeStyle='#9A7B42';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(0,46);ctx.lineTo(0,8);ctx.quadraticCurveTo(0,0,8,0);ctx.lineTo(46,0);ctx.stroke();
    ctx.beginPath();ctx.arc(20,20,5,0,2*Math.PI);ctx.fillStyle='#9A7B42';ctx.fill();ctx.restore(); };
  corner(60,60,1,1); corner(W-60,60,-1,1); corner(60,H-60,1,-1); corner(W-60,H-60,-1,-1);

  // الشعار في الأعلى
  if(logoImg && !logoImg.complete){ await new Promise(r=>{logoImg.onload=r; logoImg.onerror=r;}); }
  try{ if(logoImg && logoImg.naturalWidth){ const lw=134, lh=lw*logoImg.naturalHeight/logoImg.naturalWidth; ctx.drawImage(logoImg, cx-lw/2, 56, lw, lh); } }catch(e){}

  // العناوين
  ctx.fillStyle='#16221F';
  ctx.font='700 46px Amiri, serif';
  ctx.fillText('شهادة إتمام اختبار',cx,234);
  ctx.fillStyle='#6B5526';
  ctx.font='400 26px Amiri, serif';
  ctx.fillText(SUBJECT.title,cx,272);
  // فاصل
  ctx.strokeStyle='#C2A368'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(cx-170,296); ctx.lineTo(cx+170,296); ctx.stroke();
  ctx.fillStyle='#C2185B'; ctx.beginPath(); ctx.arc(cx,296,4.5,0,2*Math.PI); ctx.fill();

  ctx.fillStyle='#3A4A45';
  ctx.font='500 23px Tajawal, sans-serif';
  ctx.fillText('تشهد هذه الشهادة بأنّ',cx,350);

  // الاسم
  ctx.fillStyle='#0E6E5E';
  ctx.font='700 54px Amiri, serif';
  ctx.fillText(RESULT.name,cx,420);
  ctx.strokeStyle='#E4DBC6'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx-260,444); ctx.lineTo(cx+260,444); ctx.stroke();

  ctx.fillStyle='#3A4A45';
  ctx.font='500 23px Tajawal, sans-serif';
  ctx.fillText('قد أتمّ بنجاح اختبار',cx,498);
  ctx.fillStyle='#16221F';
  ctx.font='700 29px Tajawal, sans-serif';
  wrapText(ctx, RESULT.chapter, cx, 538, W-260, 38);

  // النتيجة — بطاقة
  const by=606;
  ctx.fillStyle='#0E6E5E';
  roundRect(ctx,cx-300,by,600,94,16); ctx.fill();
  ctx.fillStyle='#C2A368'; ctx.font='700 21px Tajawal, sans-serif';
  ctx.fillText('الدرجة',cx-200,by+36); ctx.fillText('النسبة',cx,by+36); ctx.fillText('التقدير',cx+200,by+36);
  ctx.fillStyle='#FBF7EE'; ctx.font='700 33px Amiri, serif';
  ctx.fillText(arDigits(RESULT.correct)+' / '+arDigits(RESULT.total),cx-200,by+74);
  ctx.fillText(arDigits(RESULT.pct)+'%',cx,by+74);
  ctx.fillText(RESULT.grade,cx+200,by+74);

  // التاريخ
  const now=new Date();
  ctx.fillStyle='#7C8A85'; ctx.font='400 20px Tajawal, sans-serif';
  const hd=hijriDate(now), gd=gregDate(now);
  ctx.fillText(hd? (hd+'  —  '+gd) : gd, cx, 772);

  // الختم السفلي
  drawRosette(ctx,cx,856,32,'#9A7B42');
  ctx.fillStyle='#6B5526'; ctx.font='700 16px Tajawal, sans-serif';
  ctx.fillText('ختم الإنجاز',cx,906);

  // تنزيل
  const safe = (RESULT.name+' - '+RESULT.chapter).replace(/[\\/:*?"<>|]/g,'').slice(0,80);
  const a=document.createElement('a');
  a.download='شهادة '+safe+'.png';
  a.href=cv.toDataURL('image/png');
  a.click();
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function wrapText(ctx,text,x,y,maxW,lh){
  const words=text.split(' '); let line='',yy=y;
  for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW && line){ ctx.fillText(line,x,yy); line=w; yy+=lh; } else line=t; }
  ctx.fillText(line,x,yy);
}

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
