/* ============ إعدادات لوحة المختبِرين ============
   لتفعيل التجميع من كل الأجهزة: املأ url و key من مشروع Supabase.
   إن تُركا فارغين، تُحفظ النتائج محليًّا على هذا الجهاز فقط (وضع مؤقّت للمعاينة). */
const CLOUD = {
  url:   'https://torkltmgjndodxwtaexn.supabase.co',
  key:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcmtsdG1nam5kb2R4d3RhZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTk0MzQsImV4cCI6MjA5Njk5NTQzNH0.Xr2uh-Xid4RmuseI03aWARpyjrMvCnirffSnWpcwiDw',
  table: 'results'
};
const STATS_PASSCODE = 'AL2islam';   // رمز دخول لوحة المعلّم
const CLOUD_ON = () => !!(CLOUD.url && CLOUD.key);

/* ============ المواد ============
   كل صفحة تعرّف SUBJECT_ID قبل تحميل هذا الملف، وبياناتها في data/<id>.js */
const SUBJECTS = {
  imla: { name:'الإملاء',      title:'تمارين الموطّأ في الإملاء', units:'الأبواب' },
  sarf: { name:'الصرف الصغير', title:'تمارين الصرف الصغير',       units:'الأقسام' }
};
const SUBJECT_KEY = (typeof SUBJECT_ID!=='undefined' && SUBJECTS[SUBJECT_ID]) ? SUBJECT_ID : 'imla';
const SUBJECT = SUBJECTS[SUBJECT_KEY];
const DEFAULT_SUBJECT = 'imla';   // السجلات القديمة بلا حقل subject تعود إلى الإملاء
const rowSubject = r => (r && r.subject && SUBJECTS[r.subject]) ? r.subject : DEFAULT_SUBJECT;
const subjectName = id => (SUBJECTS[id]||{}).name || id;

const logoImg = new Image(); logoImg.src = LOGO_SRC;

/* ============ أدوات ============ */
const $ = s => document.querySelector(s);
const shuffle = a => { const r=a.slice(); for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
const showScreen = id => { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); $(id).classList.add('active'); window.scrollTo({top:0,behavior:'auto'}); };
const arDigits = s => String(s).replace(/[0-9]/g, d=>'٠١٢٣٤٥٦٧٨٩'[d]);

/* ============ الحالة ============ */
const state = { name:'', email:'', chapter:-1, questions:[], answers:[], cur:0 };

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
function startExam(){
  if(!validate()) return;
  state.name=$('#in-name').value.trim();
  state.email=$('#in-email').value.trim();
  const ch=EXAM_DATA[state.chapter];
  // عرض عشوائي للأسئلة + ترتيب عشوائي للخيارات (دون تغيير المحتوى)
  state.questions = shuffle(ch.questions).map(q=>{
    const opts = shuffle(q.options);
    return { q:q.q, type:q.type, level:q.level, page:q.page, options:opts, correct:q.correct };
  });
  state.answers = new Array(state.questions.length).fill(null);
  state.cur=0;
  $('#exam-title').textContent = ch.title;
  $('#q-total').textContent = arDigits(state.questions.length);
  buildPalette();
  renderQuestion();
  showScreen('#screen-exam');
}

/* ============ لوحة الأسئلة ============ */
function buildPalette(){
  const g=$('#palette-grid'); g.innerHTML='';
  state.questions.forEach((_,i)=>{
    const b=document.createElement('button');
    b.className='pnum'; b.type='button'; b.textContent=arDigits(i+1);
    b.addEventListener('click',()=>{ state.cur=i; renderQuestion(); $('#palette').classList.remove('open'); });
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
      <span class="q-badge type">${q.type}</span>
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
    btn.addEventListener('click',()=>{
      state.answers[i] = q.options[+btn.dataset.opt];
      renderQuestion(); updateProgress();
    });
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
function updateProgress(){
  const done = state.answers.filter(a=>a!==null).length;
  $('#q-done').textContent=arDigits(done);
  $('#pbar-fill').style.width = (done/state.questions.length*100)+'%';
  refreshPalette();
}
function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

/* ============ التنقل والإنهاء ============ */
$('#btn-prev').addEventListener('click',()=>{ if(state.cur>0){state.cur--; renderQuestion();} });
$('#btn-next').addEventListener('click',()=>{
  if(state.cur < state.questions.length-1){ state.cur++; renderQuestion(); }
  else { tryFinish(); }
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
  const passed = pct>=60;
  const grade = pct>=90?'ممتاز': pct>=80?'جيّد جدًّا': pct>=70?'جيّد': pct>=60?'مقبول':'لم يجتز';
  RESULT={ name:state.name, email:state.email, chapter:EXAM_DATA[state.chapter].title, correct,wrong,total,pct,passed,grade };
  saveAttempt(RESULT);

  $('#result-chapter').textContent = RESULT.chapter;
  $('#res-name').textContent = state.name;
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
        <span><span class="qn">${arDigits(i+1)}.</span>${escapeHTML(q.q)}</span></div>
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
  state.chapter=-1;
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
    created_at:new Date().toISOString()
  };
}
const PENDING_KEY='almufti_pending';
const readPending=()=>{ try{ return JSON.parse(localStorage.getItem(PENDING_KEY)||'[]'); }catch(e){ return []; } };
const writePending=a=>{ try{ localStorage.setItem(PENDING_KEY, JSON.stringify(a)); }catch(e){} };
async function cloudPost(rec){
  const post = body => fetch(CLOUD.url.replace(/\/+$/,'')+'/rest/v1/'+CLOUD.table, {
    method:'POST',
    headers:{ 'apikey':CLOUD.key, 'Authorization':'Bearer '+CLOUD.key, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
    body: JSON.stringify(body)
  });
  let res = await post(rec);
  if(!res.ok){
    let txt=''; try{ txt=await res.text(); }catch(e){}
    // إن لم يُضف عمود subject بعد في الجدول، تُرسل النتيجة دونه كي لا تضيع
    if(res.status===400 && /subject/i.test(txt)){
      const { subject, ...legacy } = rec;
      console.warn('عمود subject غير موجود في جدول results — أُرسلت النتيجة بدونه.');
      res = await post(legacy);
      if(res.ok) return;
      try{ txt=await res.text(); }catch(e){ txt=''; }
    }
    throw new Error('HTTP '+res.status+(txt?' — '+txt.slice(0,300):''));
  }
}
async function saveAttempt(R){
  const rec = recFromResult(R);
  try{
    const a = JSON.parse(localStorage.getItem('almufti_results')||'[]');
    a.push(rec); localStorage.setItem('almufti_results', JSON.stringify(a));
  }catch(e){}
  if(!CLOUD_ON()) return;
  try{ await cloudPost(rec); }
  catch(e){
    console.error('[almufti] تعذّر إرسال النتيجة إلى السحابة؛ أُضيفت لطابور إعادة المحاولة:', e.message);
    const q=readPending(); q.push(rec); writePending(q);
  }
}
/* إعادة إرسال النتائج التي فشل إرسالها سابقًا (عند فتح الصفحة) */
async function flushPending(){
  if(!CLOUD_ON()) return;
  const q=readPending(); if(!q.length) return;
  const left=[];
  for(const rec of q){
    try{ await cloudPost(rec); }
    catch(e){ console.error('[almufti] ما زال الإرسال متعذّرًا:', e.message); left.push(rec); }
  }
  writePending(left);
}
async function loadAttempts(){
  if(CLOUD_ON()){
    const res = await fetch(CLOUD.url.replace(/\/+$/,'')+'/rest/v1/'+CLOUD.table+'?select=*&order=created_at.desc&limit=5000', {
      headers:{ 'apikey':CLOUD.key, 'Authorization':'Bearer '+CLOUD.key }
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }
  try{ return JSON.parse(localStorage.getItem('almufti_results')||'[]').slice().reverse(); }catch(e){ return []; }
}
function fmtDate(iso){
  try{ return new Intl.DateTimeFormat('ar-EG',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)); }
  catch(e){ return iso||''; }
}
let STATS_DATA=[];
function openStats(){
  showScreen('#screen-stats');
  if(sessionStorage.getItem('almufti_stats_ok')==='1'){
    $('#stats-gate').style.display='none'; $('#stats-body').style.display='block'; loadAndRender();
  }else{
    $('#stats-gate').style.display='block'; $('#stats-body').style.display='none';
    $('#gate-pass').value=''; $('#gate-err').classList.remove('show'); setTimeout(()=>$('#gate-pass').focus(),60);
  }
}
function statsUnlock(){
  if($('#gate-pass').value.trim()===String(STATS_PASSCODE)){
    sessionStorage.setItem('almufti_stats_ok','1');
    $('#stats-gate').style.display='none'; $('#stats-body').style.display='block'; loadAndRender();
  }else{ $('#gate-err').classList.add('show'); }
}
async function loadAndRender(){
  const note=$('#stats-note'); note.textContent='…جارٍ التحميل'; note.classList.remove('err');
  try{
    STATS_DATA = await loadAttempts();
    const chip=$('#conn-chip');
    chip.textContent = CLOUD_ON()? 'متصل بالسحابة' : 'محلي (هذا الجهاز فقط)';
    chip.className = 'chip '+(CLOUD_ON()?'chip-ok':'chip-warn');
    buildSubjectFilter(); buildChapterFilter(); renderStats();
    note.textContent = (CLOUD_ON() && !STATS_DATA.length)
      ? 'لا توجد سجلات مقروءة في السحابة. إن كان الطلاب قد اختبروا فعلًا فتحقّق من سياسات RLS لجدول «'+CLOUD.table+'» (insert و select للدور anon).'
      : '';
  }catch(e){
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
}
function exportCSV(){
  const rows=currentRows();
  const head=['الاسم','البريد','المادة','الباب/القسم','صحيح','خطأ','المجموع','النسبة','التقدير','اجتاز','التاريخ'];
  const esc=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
  const lines=[head.join(',')].concat(rows.map(r=>[r.name,r.email,subjectName(rowSubject(r)),r.chapter,r.correct,r.wrong,r.total,r.pct,r.grade,(r.passed||+r.pct>=60)?'نعم':'لا',fmtDate(r.created_at)].map(esc).join(',')));
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='بيانات-المختبرين.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

/* ============ ربط الأحداث ============ */
$('#btn-start').addEventListener('click',startExam);
$('#btn-cert').addEventListener('click',generateCertificate);
$('#btn-restart').addEventListener('click',restart);
$('#palette-toggle').addEventListener('click',()=>$('#palette').classList.toggle('open'));
$('#btn-open-stats').addEventListener('click',openStats);
$('#gate-unlock').addEventListener('click',statsUnlock);
$('#gate-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') statsUnlock(); });
$('#gate-pass').addEventListener('input',()=>$('#gate-err').classList.remove('show'));
['stats-back','stats-back2'].forEach(id=>{ const el=$('#'+id); if(el) el.addEventListener('click',()=>showScreen('#screen-start')); });
$('#stats-refresh').addEventListener('click',loadAndRender);
$('#stats-export').addEventListener('click',exportCSV);
$('#stats-search').addEventListener('input',renderStats);
$('#stats-chapter').addEventListener('change',renderStats);
$('#stats-subject').addEventListener('change',()=>{ buildChapterFilter(); renderStats(); });
['in-name','in-email'].forEach(id=>$('#'+id).addEventListener('input',()=>{
  $('#'+id).classList.remove('invalid'); $('#err-'+id.split('-')[1]).classList.remove('show');
}));

document.getElementById('brand-logo-1').src = LOGO_SRC;
document.getElementById('brand-logo-2').src = LOGO_SRC;
buildChapters();
flushPending();
