(function () {
'use strict';
const WO = window.WO;
const { ymd, parseYmd, addDays, diffDays, startOfWeek, DOW, DOW3, MONTHS, clone } = WO;
const root = document.getElementById('app');
const syncEl = document.getElementById('sync');

/* ---------- tiny DOM helper ---------- */
const PROPS = { value: 1, checked: 1, disabled: 1, selected: 1 };
function h(tag, props) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (PROPS[k]) el[k] = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  const kids = Array.prototype.slice.call(arguments, 2);
  (function add(list) {
    list.forEach(c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) add(c);
      else el.append(c.nodeType ? c : document.createTextNode(String(c)));
    });
  })(kids);
  return el;
}
const ICON = {
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16 16 4l4 4L8 20z"/><path d="m8 12 2 2M11 9l2 2M14 6l2 2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H10l-5 4v-4H4z"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
};
function icon(name, cls) { const s = document.createElement('span'); s.className = cls || 'ic'; s.style.display = 'inline-flex'; s.innerHTML = ICON[name]; return s; }
const fmtNum = n => Number(n).toLocaleString('en-US');
const fmtShort = ds => { const d = parseYmd(ds); return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
const fmtLong = ds => { const d = parseYmd(ds); return DOW[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); };
const todayStr = () => ymd(new Date());

/* ---------- notes with a hard limit, live counter, no silent cutting ---------- */
const NOTE_MAX = 1000;
function noteField(o) {
  const ta = h('textarea', { id: o.id, 'aria-label': o.label, placeholder: o.placeholder, maxlength: String(NOTE_MAX), disabled: o.disabled, value: o.value || '', style: o.minH ? 'min-height:' + o.minH : null });
  const cnt = h('span', { class: 'cnt' }), msg = h('span', { class: 'cnt-msg', role: 'status' });
  const paint = () => {
    const n = ta.value.length;
    cnt.textContent = n + ' / ' + NOTE_MAX;
    cnt.className = 'cnt' + (n > NOTE_MAX ? ' over' : n >= NOTE_MAX * 0.9 ? ' near' : '');
    if (n > NOTE_MAX) msg.textContent = 'Over the limit by ' + (n - NOTE_MAX) + '. Your text is kept unchanged; shorten it to continue.';
  };
  const refuse = total => { msg.textContent = 'Not added: it would be ' + (total - NOTE_MAX) + ' characters over the ' + NOTE_MAX + ' limit. Shorten it and try again.'; };
  ta.addEventListener('paste', e => {
    const t = (e.clipboardData && e.clipboardData.getData('text')) || '';
    const total = ta.value.length - (ta.selectionEnd - ta.selectionStart) + t.length;
    if (total > NOTE_MAX) { e.preventDefault(); refuse(total); }
  });
  ta.addEventListener('drop', e => {
    const t = (e.dataTransfer && e.dataTransfer.getData('text')) || '';
    if (t && ta.value.length + t.length > NOTE_MAX) { e.preventDefault(); refuse(ta.value.length + t.length); }
  });
  ta.addEventListener('input', () => { msg.textContent = ''; paint(); if (o.onInput) o.onInput(ta.value); });
  paint();
  return h('div', { class: 'notefield' }, ta, h('div', { class: 'cnt-row' }, msg, cnt));
}

/* ---------- timers and set counters for warm-ups and stretches ---------- */
function parseTimed(text) {
  let m = text.match(/^(\d+)\s*min\b/);
  if (m) return { secs: +m[1] * 60, n: 1 };
  m = text.match(/(\d+)\s*[x×]\s*(\d+)(?:\s*(s|min)\b)?(.*)$/i);
  if (!m) return null;
  const sets = +m[1], amt = +m[2];
  if (m[3]) {
    const sides = /\bper\s+(arm|leg|side|shoulder)\b/i.test(m[4]) ? 2 : 1;
    return { secs: amt * (m[3].toLowerCase() === 'min' ? 60 : 1), n: sets * sides };
  }
  return { secs: null, n: sets };
}
const fmtSecs = s => s >= 60 ? (s / 60) + ' min' : s + ' s';
const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

/* ---------- storage ---------- */
const S = { docs: {}, ready: false, uid: null, mode: 'local' };
let dbCol = null;
const dirty = new Set(), inflight = new Set(), fails = {};
let flushTimer = null, mirrorTimer = null;
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const lsKey = () => 'workitout.v1.' + (S.uid || 'anon');
function lsRead(key) { try { return JSON.parse(localStorage.getItem(key || lsKey()) || 'null'); } catch (e) { return null; } }
function lsWrite() { try { localStorage.setItem(lsKey(), JSON.stringify(S.docs)); } catch (e) { /* storage unavailable */ } }
function setSync(state) {
  const labels = { ok: 'Saved', saving: 'Saving', local: 'On this device', error: 'Save pending' };
  syncEl.className = 'sync ' + state;
  syncEl.querySelector('span').textContent = labels[state] || '';
}
function persist(id) {
  dirty.add(id);
  clearTimeout(mirrorTimer); mirrorTimer = setTimeout(lsWrite, 250);
  if (!dbCol) { setSync('local'); return; }
  setSync('saving');
  clearTimeout(flushTimer); flushTimer = setTimeout(flush, 700);
}
async function flush() {
  if (!dbCol) return;
  const ids = Array.from(dirty);
  let failed = false;
  for (const id of ids) {
    if (inflight.has(id)) continue;
    dirty.delete(id); inflight.add(id);
    try {
      const ref = dbCol.doc(id);
      if (S.docs[id] === undefined) await ref.delete(); else await ref.set(clone(S.docs[id]));
      fails[id] = 0;
    } catch (e) {
      failed = true; fails[id] = (fails[id] || 0) + 1; dirty.add(id);
    } finally { inflight.delete(id); }
  }
  if (failed) {
    setSync('error');
    if (ids.some(id => dirty.has(id) && fails[id] < 4)) flushTimer = setTimeout(flush, 6000);
  } else if (dirty.size) flushTimer = setTimeout(flush, 700);
  else setSync('ok');
}
async function initStore() {
  let db = null, uid = null;
  try {
    const c = window.claude;
    if (c && c.use) {
      const user = await withTimeout(c.use('user'), 4000);
      uid = user ? await withTimeout(user.id(), 4000) : null;
      if (uid) db = await withTimeout(c.use('db'), 4000);
    }
  } catch (e) { db = null; }
  S.uid = uid || null;
  if (db && uid) {
    try {
      const col = db.collection('data/users/' + uid);
      const snap = await withTimeout(col.limit(1000).get(), 10000);
      const docs = {};
      snap.docs.forEach(d => { docs[d.id] = clone(d.data()); });
      dbCol = col; S.mode = 'db'; S.docs = docs;
      if (!docs.plan) {
        const local = lsRead() || lsRead('workitout.v1.anon');
        if (local && local.plan) { S.docs = local; Object.keys(local).forEach(id => dirty.add(id)); flushTimer = setTimeout(flush, 300); }
      }
      setSync('ok');
      return;
    } catch (e) { dbCol = null; }
  }
  S.mode = 'local';
  S.docs = lsRead() || {};
  setSync('local');
}
function ensurePlan() {
  if (S.docs.plan && S.docs.plan.plan) return;
  const profile = clone(WO.DEFAULT_PROFILE);
  S.docs.plan = { plan: WO.generatePlan(profile, {}), profile, start: todayStr(), createdAt: new Date().toISOString(), isDefault: true };
  persist('plan');
}
function ensureDay(ds) {
  const id = 'd_' + ds;
  if (!S.docs[id]) S.docs[id] = { date: ds, sets: {}, checks: {}, last: {}, meals: {}, cnt: {}, mealVals: {}, loads: {}, feedback: '', done: false };
  const d = S.docs[id];
  d.sets = d.sets || {}; d.checks = d.checks || {}; d.last = d.last || {}; d.meals = d.meals || {}; d.cnt = d.cnt || {}; d.mealVals = d.mealVals || {}; d.loads = d.loads || {};
  return d;
}
const P = () => S.docs.plan;
function refreshDone(ds, doc) {
  const entry = WO.entryFor(P().plan, parseYmd(ds));
  const pr = WO.dayProgress(P().plan, entry, doc);
  const was = doc.done;
  doc.done = pr.complete; doc.kind = entry.kind;
  if (pr.complete && !was) doc.doneAt = Date.now();
  return pr;
}
function dayState(ds) {
  const doc = S.docs['d_' + ds];
  if (doc && doc.done) return 'done';
  const n = diffDays(parseYmd(P().start), parseYmd(ds));
  if (n < 0) return 'out';
  const entry = WO.entryFor(P().plan, parseYmd(ds));
  if (entry.kind === 'rest') return 'rest';
  if (doc && WO.dayProgress(P().plan, entry, doc).done > 0) return 'partial';
  return 'open';
}

function mealVal(doc, m) {
  const o = doc && doc.mealVals && doc.mealVals[m.slot];
  return { kcal: o && typeof o.kcal === 'number' ? o.kcal : m.kcal, protein: o && typeof o.protein === 'number' ? o.protein : m.protein, edited: !!(o && (typeof o.kcal === 'number' || typeof o.protein === 'number')) };
}
const NUM_RE = /\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?/;
const withNumber = (planStr, n) => (planStr && NUM_RE.test(planStr)) ? planStr.replace(NUM_RE, String(n)) : n + ' lb';
function loadLog(key, uptoDs) {
  const out = [];
  Object.keys(S.docs).forEach(k => {
    if (k.slice(0, 2) !== 'd_') return;
    const d = S.docs[k], v = d.loads && d.loads[key];
    if (typeof v === 'number' && (!uptoDs || d.date <= uptoDs)) out.push({ date: d.date, v });
  });
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
function prevLoad(key, ds) { const l = loadLog(key).filter(x => x.date < ds); return l.length ? l[l.length - 1] : null; }
const hasLoadField = ex => ex.weight !== 'Bodyweight' && ex.key.indexOf('ss_') !== 0;
function latestMeasure(id) {
  const keys = Object.keys(S.docs).filter(k => k.startsWith('t_')).sort().reverse();
  for (const k of keys) { const t = S.docs[k]; if (t.values && typeof t.values[id] === 'number') return t.values[id]; }
  return null;
}

/* ---------- routing ---------- */
let cur = 'home';
function parseHash() {
  const t = (location.hash || '').replace('#', '');
  if (t === 'consult') return 'consult';
  if (t === 'settings') return 'settings';
  if (/^day-\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return 'home';
}
function go(r) {
  const changed = cur !== r;
  cur = r;
  try { location.hash = r; } catch (e) { /* hash unavailable */ }
  if (!changed) render();
  else render();
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}
window.addEventListener('hashchange', () => {
  const r = parseHash();
  if (r !== cur) { cur = r; render(); try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } }
});

/* ---------- timers, toast, modal ---------- */
let timers = [];
function addTimer(id) { timers.push(id); return id; }
function clearTimers() { timers.forEach(t => { clearInterval(t); clearTimeout(t); }); timers = []; }
let toastEl = null, toastT = null;
function toast(msg) {
  if (toastEl) toastEl.remove();
  toastEl = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(toastEl);
  clearTimeout(toastT); toastT = setTimeout(() => { if (toastEl) toastEl.remove(); toastEl = null; }, 2400);
}
let modalEl = null, modalKey = null;
function closeModal() {
  if (modalEl) { modalEl.remove(); modalEl = null; }
  if (modalKey) { document.removeEventListener('keydown', modalKey); modalKey = null; }
}
function openModal(content, label) {
  closeModal();
  const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label || 'Dialog' }, content);
  modalEl = h('div', { class: 'overlay', onclick: e => { if (e.target === modalEl) closeModal(); } }, modal);
  document.body.append(modalEl);
  modalKey = e => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', modalKey);
  const f = modal.querySelector('button, input, textarea, select');
  if (f) f.focus();
}

/* ---------- optional Claude review ---------- */
const AI_KEY_NAME = 'workitout.aikey';
const AI_MODEL = 'claude-haiku-5-5';
function getAiKey() { try { return localStorage.getItem(AI_KEY_NAME) || ''; } catch (e) { return ''; } }
function setAiKey(v) { try { if (v) localStorage.setItem(AI_KEY_NAME, v); else localStorage.removeItem(AI_KEY_NAME); return true; } catch (e) { return false; } }
async function askAnthropic(prompt, key) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) { toast('AI review unavailable (' + res.status + '). Check your API key.'); return null; }
    const data = await res.json();
    const text = data && data.content && data.content[0] && data.content[0].text || '';
    const m = String(text).match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}
async function askAI(prompt) {
  try {
    if (!window.claude || !window.claude.use) {
      const k = window.WO_PUBLIC ? getAiKey() : '';
      return k ? await askAnthropic(prompt, k) : null;
    }
    const sample = await withTimeout(window.claude.use('sample'), 5000);
    if (!sample) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      let r;
      if (typeof sample.json === 'function') r = await sample.json(prompt, { signal: ctrl.signal, modelTier: 'quick', cache: false });
      else {
        const o = await sample(prompt, { signal: ctrl.signal, modelTier: 'quick', cache: false });
        const m = String(o && o.text || '').match(/\{[\s\S]*\}/);
        r = m ? JSON.parse(m[0]) : null;
      }
      if (r && r.value && typeof r.value === 'object' && !r.questions && !r.note) r = r.value;
      return r && typeof r === 'object' ? r : null;
    } finally { clearTimeout(t); }
  } catch (e) { return null; }
}
function cleanAI(r) {
  if (!r) return null;
  const out = { questions: [], areas: [], diet: [], calorie_adjust: 0, coach_note: '' };
  if (Array.isArray(r.questions)) out.questions = r.questions.map(q => (typeof q === 'string' ? q : q && q.q)).filter(q => typeof q === 'string' && q.trim()).map(q => q.trim().slice(0, 220)).slice(0, 2);
  if (Array.isArray(r.areas)) out.areas = r.areas.filter(a => WO.FLAG_WORDS[a]);
  if (Array.isArray(r.diet)) out.diet = r.diet.filter(d => WO.DIET_LABEL[d]);
  out.calorie_adjust = Math.max(-200, Math.min(200, Number(r.calorie_adjust) || 0));
  if (typeof r.coach_note === 'string') out.coach_note = r.coach_note.trim().slice(0, 300);
  return out;
}
async function aiReview(v, answersText) {
  const prompt = 'You are a strength and nutrition coach reviewing a client intake before a rules engine builds the plan. ' +
    'Client JSON: ' + JSON.stringify(v) + (answersText ? ' Answers to earlier questions: ' + answersText : '') + '\n' +
    'Return ONLY a JSON object: {"questions":[strings],"areas":[strings],"diet":[strings],"calorie_adjust":number,"coach_note":string}. ' +
    'questions: at most 2, only if the answer would change the plan (injury detail, schedule limits, food restrictions); otherwise []. ' +
    'areas: body areas with a limit mentioned, from ["shoulder","knee","lower_back","wrist_elbow","neck","hip","ankle"]. ' +
    'diet: restrictions mentioned, from ["vegan","vegetarian","pescatarian","dairyfree","glutenfree","nutfree","eggfree"]. ' +
    'calorie_adjust: integer between -200 and 200 kcal to nudge the daily target, usually 0. ' +
    'coach_note: at most 45 words, plain and specific to this client, no hype, no diagnosis.';
  return cleanAI(await askAI(prompt));
}

/* ---------- shared pieces ---------- */
function backBtn() { return h('button', { class: 'btn ghost back', type: 'button', onclick: () => go('home') }, icon('left'), 'Back'); }
function chip(t) { return h('span', { class: 'chip' }, t); }
function pill(kind, text) { return h('span', { class: 'pill ' + kind }, text); }
function sectionCard(title, body, extra) {
  return h('section', { class: 'card' }, h('div', { class: 'sec-head' }, h('h2', { class: 'sec' }, title), extra || null), body);
}
function seg(options, get, set) {
  const box = h('div', { class: 'seg' });
  const paint = () => Array.from(box.children).forEach((b, i) => b.setAttribute('aria-pressed', String(get() === options[i][0])));
  options.forEach(o => box.append(h('button', { type: 'button', onclick: () => { set(o[0]); paint(); } }, o[1])));
  paint();
  return box;
}

/* ---------- home ---------- */
let calMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

function latestTouch() {
  const keys = Object.keys(S.docs).filter(k => k.startsWith('tb_') && S.docs[k].submitted).sort();
  return keys.length ? S.docs[keys[keys.length - 1]] : null;
}
function viewHome() {
  const pd = P(), plan = pd.plan;
  const dayNo = diffDays(parseYmd(pd.start), new Date()) + 1;
  const goal = h('section', { class: 'card' },
    window.WO_PUBLIC && pd.isDefault ? h('div', { class: 'notice' }, h('span', null, 'This is a sample program. ', getAiKey() ? 'Tap Reconsult to build your own.' : [h('a', { href: '#settings' }, 'Connect an API key'), ' for personalized advice, then tap Reconsult to build your own.'])) : null,
    h('div', { class: 'eyebrow' }, 'Your program' + (dayNo >= 1 ? ' · Day ' + dayNo : '')),
    h('h1', { class: 'goal' }, plan.goal.label),
    h('p', { class: 'lead' }, plan.goal.line),
    h('div', { class: 'chips' },
      chip(plan.stats.strengthDays + ' strength'), plan.stats.swimDays ? chip(plan.stats.swimDays + ' swim') : null, chip(plan.stats.restDays + ' rest'),
      chip('~' + fmtNum(plan.stats.kcal) + ' kcal'), chip('~' + plan.stats.protein + ' g protein')),
    h('ul', { class: 'guides' }, plan.guidelines.map(g => h('li', null, g))),
    plan.cautions && plan.cautions.length ? h('div', { class: 'notice' }, plan.cautions.map(c => h('span', null, c))) : null,
    plan.coachNote ? h('div', { class: 'note-coach' }, h('b', null, 'Coach note: '), plan.coachNote) : null,
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { C = newConsult(); go('consult'); } }, 'Reconsult')));

  const week = weekCard();
  const cal = h('section', { class: 'card' }, h('div', { id: 'calbox' }, calendarEl()));
  const lt = latestTouch();
  const touch = lt ? h('section', { class: 'card' },
    h('div', { class: 'sec-head' }, h('h2', { class: 'sec' }, 'Latest touch base'), h('span', { class: 'muted small' }, fmtShort(lt.date))),
    h('ul', { class: 'recs' }, (lt.recs || []).slice(0, 4).map(r => h('li', null, r))),
    lt.coach ? h('div', { class: 'note-coach' }, lt.coach) : null) : null;
  return h('div', { class: 'wrap-inner', style: 'display:flex;flex-direction:column;gap:22px' }, goal, week, cal, touch);
}
const DOC_ID = /^(plan|d_\d{4}-\d{2}-\d{2}|t_\d{4}-\d{2}-\d{2}|tb_\d{4}-\d{2}-\d{2})$/;
function exportData() {
  try {
    const blob = new Blob([JSON.stringify({ app: 'workitout', v: 1, exportedAt: new Date().toISOString(), docs: S.docs }, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'workitout-' + todayStr() + '.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Backup downloaded');
  } catch (e) { toast('Download is not available here'); }
}
function importData(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast('That file is too large to be a WORKitOUT backup'); return; }
  const fr = new FileReader();
  fr.onerror = () => toast('Could not read that file');
  fr.onload = () => {
    let data = null;
    try { data = JSON.parse(String(fr.result)); } catch (e) { /* invalid */ }
    const docs = data && data.app === 'workitout' && data.docs && typeof data.docs === 'object' ? data.docs : null;
    if (!docs || !docs.plan || !docs.plan.plan || !docs.plan.plan.schedule) { toast('That is not a WORKitOUT backup'); return; }
    const clean = {};
    Object.keys(docs).forEach(k => { if (DOC_ID.test(k) && docs[k] && typeof docs[k] === 'object') clean[k] = docs[k]; });
    clean.plan = Object.assign({}, clean.plan, { isDefault: false });
    const days = Object.keys(clean).filter(k => k.slice(0, 2) === 'd_').length;
    openModal([
      h('h2', null, 'Restore this backup?'),
      h('p', null, 'This replaces everything in the app on this device with the backup: your program, ' + days + ' logged days, tracking and check-ins. Current data that is not in the backup is lost.'),
      h('div', { class: 'acts' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: closeModal }, 'Cancel'),
        h('button', { class: 'btn accent sm', type: 'button', onclick: () => {
          Object.keys(S.docs).forEach(k => { if (!(k in clean)) { delete S.docs[k]; dirty.add(k); } });
          Object.keys(clean).forEach(k => { S.docs[k] = clean[k]; dirty.add(k); });
          persist('plan'); closeModal(); calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          toast('Backup restored'); go('home');
        } }, 'Yes, restore')),
    ], 'Restore backup');
  };
  fr.readAsText(file);
}
function aiKeyCard() {
  const inp = h('input', { type: 'password', id: 'ai-key', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Anthropic API key', placeholder: getAiKey() ? 'Key saved on this device' : 'sk-ant-...' });
  const stat = h('div', { class: 'saved-note', role: 'status' }, getAiKey() ? 'AI advice is on.' : 'AI advice is off. Plans use fixed rules only.');
  return h('section', { class: 'card' }, h('h2', { class: 'sec' }, 'AI advice (requires an API key)'),
    h('p', { class: 'muted' }, 'Add your own Anthropic API key to get personalized advice: clarifying questions and a short coach note based on what you write. Without a key the app still builds plans and recommendations from fixed rules, but without personal questions or notes. The key stays in this browser and is never included in backups. Requests go straight from your browser to Anthropic, and the text you write in limits, notes and check-ins is sent with them. You pay Anthropic for usage, so create a key with a spending limit.'),
    h('div', { style: 'margin-top:14px' }, inp),
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { const v = inp.value.trim(); if (!v) { toast('Paste a key first'); return; } if (setAiKey(v)) { inp.value = ''; inp.placeholder = 'Key saved on this device'; stat.textContent = 'AI advice is on.'; toast('Key saved'); } else toast('Could not save the key in this browser'); } }, 'Save key'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { setAiKey(''); inp.value = ''; inp.placeholder = 'sk-ant-...'; stat.textContent = 'AI advice is off. Plans use fixed rules only.'; toast('Key removed'); } }, 'Remove key')),
    stat);
}
function dataCard() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', 'aria-label': 'Choose a WORKitOUT backup file', onchange: e => { importData(e.target.files[0]); e.target.value = ''; } });
  return h('section', { class: 'card' }, h('h2', { class: 'sec' }, 'Your data'),
    h('p', { class: 'muted' }, S.mode === 'db' ? 'Your progress is saved to your account. Download a backup any time.' : 'Your progress is saved in this browser only. Download a backup to keep it safe or to move to another device.'),
    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn ghost sm', type: 'button', onclick: exportData }, 'Download backup'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => input.click() }, 'Restore from backup'), input));
}
function viewSettings() {
  return h('div', { style: 'display:flex;flex-direction:column;gap:22px' },
    h('div', { class: 'topbar' }, backBtn()),
    h('section', { class: 'card' }, h('div', { class: 'eyebrow' }, 'WORKitOUT'), h('h1', { class: 'page' }, 'Settings')),
    window.WO_PUBLIC ? aiKeyCard() : null,
    dataCard(),
    h('div', { class: 'topbar' }, backBtn()));
}
function weekCard() {
  const plan = P().plan, ws = startOfWeek(new Date()), tds = todayStr();
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(ws, i), ds = ymd(date), e = plan.schedule[i], st = dayState(ds);
    let status;
    if (st === 'done') status = pill('done', 'Done');
    else if (st === 'rest') status = pill('rest', 'Rest');
    else if (st === 'partial') status = pill('prog', 'In progress');
    else if (st === 'out') status = pill('', '—');
    else if (ds === tds) status = pill('today', 'Today');
    else if (ds < tds) status = pill('', 'Missed');
    else status = pill('', 'Planned');
    const go1 = () => go('day-' + ds);
    rows.push(h('tr', { class: 'row-day' + (ds === tds ? ' today' : ''), tabindex: '0', role: 'link', 'aria-label': e.title + ', ' + DOW[i], onclick: go1, onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go1(); } } },
      h('td', null, h('div', { class: 'dcell' }, h('b', null, DOW3[i]), h('span', null, fmtShort(ds)))),
      h('td', null, h('div', { class: 'sess' }, h('b', null, e.title), h('span', null, e.focus))),
      h('td', null, status)));
  }
  return sectionCard('This week', h('div', { class: 'tbl-wrap' }, h('table', { class: 'week' },
    h('thead', null, h('tr', null, h('th', null, 'Day'), h('th', null, 'Session'), h('th', null, 'Status'))),
    h('tbody', null, rows))));
}
function calendarEl() {
  const pd = P(), start = pd.start, tds = todayStr();
  const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + dim) / 7);
  const cells = [];
  DOW3.forEach(d => cells.push(h('div', { class: 'cal-dow' }, d.slice(0, 3))));
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(gridStart, i), ds = ymd(date);
    const inMonth = date.getMonth() === first.getMonth();
    const st = dayState(ds);
    const cls = ['cal-cell'];
    if (!inMonth) cls.push('out');
    if (st === 'done') cls.push('done'); else if (st === 'rest') cls.push('rest'); else if (st === 'partial') cls.push('prog');
    if (ds === tds) cls.push('today');
    const inProg = diffDays(parseYmd(start), date) >= 0;
    const isT = inProg && WO.trackingDay(start, ds), isB = inProg && WO.touchDay(start, ds);
    const marks = [];
    if (isT) { const sp = icon('ruler', (S.docs['t_' + ds] && S.docs['t_' + ds].saved) ? 'saved' : 'pending'); sp.setAttribute('title', 'Weekly tracking'); marks.push(sp); }
    if (isB) { const sp = icon('chat', (S.docs['tb_' + ds] && S.docs['tb_' + ds].submitted) ? 'saved' : 'pending'); sp.setAttribute('title', 'Touch base'); marks.push(sp); }
    const label = fmtLong(ds) + (isT ? ', weekly tracking' : '') + (isB ? ', touch base' : '') + (st === 'done' ? ', done' : st === 'rest' ? ', rest day' : '');
    cells.push(h('button', { class: cls.join(' '), type: 'button', 'aria-label': label, onclick: () => onCalClick(ds, isT, isB) }, String(date.getDate()), marks.length ? h('span', { class: 'mk' }, marks) : null));
  }
  return h('div', null,
    h('div', { class: 'cal-head' }, h('h2', null, MONTHS[first.getMonth()] + ' ' + first.getFullYear()),
      h('div', { class: 'cal-nav' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous month', onclick: () => { calMonth = new Date(first.getFullYear(), first.getMonth() - 1, 1); refreshCalendar(); } }, icon('left')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next month', onclick: () => { calMonth = new Date(first.getFullYear(), first.getMonth() + 1, 1); refreshCalendar(); } }, icon('right')))),
    h('div', { class: 'cal-grid' }, cells),
    h('div', { class: 'legend' },
      h('span', null, h('i', { class: 'sw done' }), 'Done'), h('span', null, h('i', { class: 'sw rest' }), 'Rest day'), h('span', null, h('i', { class: 'sw today' }), 'Today'),
      h('span', null, icon('ruler'), 'Weekly tracking'), h('span', null, icon('chat'), 'Touch base')));
}
function refreshCalendar() { const b = document.getElementById('calbox'); if (b) b.replaceChildren(calendarEl()); }
function onCalClick(ds, isT, isB) {
  if (isT || isB) openCheckin(ds, isT, isB);
  else go('day-' + ds);
}

/* ---------- check-in modal: tracking + touch base ---------- */
function prevValue(id, ds) {
  const keys = Object.keys(S.docs).filter(k => k.startsWith('t_') && k < 't_' + ds).sort().reverse();
  for (const k of keys) {
    const t = S.docs[k];
    if (t.values && typeof t.values[id] === 'number') return { v: t.values[id], date: t.date };
  }
  return null;
}
function openCheckin(ds, isT, isB) {
  const canEdit = ds <= todayStr();
  const parts = [h('h2', null, fmtLong(ds))];
  if (!canEdit) parts.push(h('p', { class: 'muted' }, 'This check-in opens on ' + fmtLong(ds) + '.'));
  if (isT) parts.push(trackingSection(ds, canEdit));
  if (isB) parts.push(touchSection(ds, canEdit));
  parts.push(h('div', { class: 'acts' },
    h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { closeModal(); go('day-' + ds); } }, 'Open that day'),
    h('button', { class: 'btn sm', type: 'button', onclick: closeModal }, 'Close')));
  openModal(parts, 'Check-in');
}
const MEAS = [['weight', 'Weight', 'kg'], ['waist', 'Waist', 'cm'], ['bodyfat', 'Body fat', '%'], ['chest', 'Chest', 'cm'], ['arm', 'Arm', 'cm']];
const trackItems = plan => {
  const items = plan.tracking.slice();
  if (!items.some(i => i.id === 'bodyfat')) {
    const at = Math.max(0, items.findIndex(i => i.id === 'weight') + 1);
    items.splice(at, 0, { id: 'bodyfat', label: 'Body fat estimate', unit: '%' });
  }
  return items;
};
function trackingSection(ds, canEdit) {
  const id = 't_' + ds, plan = P().plan;
  if (!S.docs[id]) S.docs[id] = { date: ds, checks: {}, values: {}, joints: '', notes: '', saved: false };
  const doc = S.docs[id];
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => persist(id), 400); };
  const items = trackItems(plan).map(it => {
    const cb = h('input', { type: 'checkbox', id: 'tk-' + it.id, checked: !!doc.checks[it.id], disabled: !canEdit, onchange: e => { doc.checks[it.id] = e.target.checked; save(); } });
    let inp = null, hint = null;
    if (it.unit) {
      const pv = prevValue(it.id, ds);
      inp = h('div', { class: 'in' },
        h('input', { type: 'number', inputmode: 'decimal', step: '0.1', id: 'tv-' + it.id, 'aria-label': it.label + ' (' + it.unit + ')', value: typeof doc.values[it.id] === 'number' ? doc.values[it.id] : '', disabled: !canEdit,
          oninput: e => { const n = parseFloat(e.target.value); if (isNaN(n)) delete doc.values[it.id]; else { doc.values[it.id] = n; doc.checks[it.id] = true; cb.checked = true; } save(); } }),
        h('span', { class: 'muted' }, it.unit));
      if (pv) hint = h('div', { class: 'last' }, 'Last: ' + pv.v + ' ' + it.unit + ' on ' + fmtShort(pv.date));
    } else if (it.select) {
      inp = h('div', { class: 'in' }, h('select', { id: 'ts-' + it.id, 'aria-label': it.label, disabled: !canEdit, onchange: e => { doc.joints = e.target.value; doc.checks[it.id] = true; cb.checked = true; save(); } },
        h('option', { value: '' }, 'Select'), it.select.map(o => h('option', { value: o, selected: doc.joints === o }, o))));
    }
    return h('div', { class: 'trk' }, cb, h('div', null, h('label', { for: 'tk-' + it.id }, it.label), inp, hint));
  });
  const notes = noteField({ id: 'tk-notes', label: 'Tracking findings', placeholder: 'Findings (how it felt, what changed)', disabled: !canEdit, value: doc.notes || '', onInput: v => { doc.notes = v; save(); } });
  const saveBtn = h('button', { class: 'btn accent sm', type: 'button', disabled: !canEdit, onclick: () => { doc.saved = true; doc.savedAt = Date.now(); persist(id); refreshCalendar(); toast('Tracking saved'); } }, doc.saved ? 'Update tracking' : 'Save tracking');
  return h('div', { class: 'sub' }, h('h3', null, 'Weekly tracking'), items, notes, h('div', null, saveBtn));
}
const JRANK = { Fine: 0, Tight: 1, Painful: 2 };
function touchSummary(ds) {
  const pd = P(), per = WO.touchPeriod(pd.start, ds);
  const from = parseYmd(per.from), to = parseYmd(ds), td = parseYmd(todayStr());
  const end = to > td ? td : to;
  let planned = 0, done = 0; const notes = [];
  const meals = { days: 0, kcal: 0, protein: 0, pKcal: 0, pProtein: 0 };
  for (let d = from; d <= end; d = addDays(d, 1)) {
    if (diffDays(parseYmd(pd.start), d) < 0) continue;
    const s = ymd(d), e = WO.entryFor(pd.plan, d), doc = S.docs['d_' + s];
    if (e.kind !== 'rest') { planned++; if (doc && doc.done) done++; }
    if (doc && doc.feedback && doc.feedback.trim()) notes.push({ date: s, text: doc.feedback.trim() });
    if (doc && doc.meals) {
      const menu = pd.plan.menus[d.getDay()];
      const eaten = menu.meals.filter(m => doc.meals[m.slot]);
      if (eaten.length === menu.meals.length) {
        meals.days++;
        eaten.forEach(m => { const v = mealVal(doc, m); meals.kcal += v.kcal; meals.protein += v.protein; });
        meals.pKcal += menu.kcal; meals.pProtein += menu.protein;
      }
    }
  }
  const tr = Object.keys(S.docs).filter(k => k.startsWith('t_')).sort().map(k => S.docs[k]).filter(t => t.date >= pd.start && t.date <= ds);
  const meas = {};
  MEAS.forEach(m => {
    const arr = tr.map(t => t.values && t.values[m[0]]).filter(v => typeof v === 'number' && !isNaN(v));
    if (arr.length) meas[m[0]] = { first: arr[0], last: arr[arr.length - 1], n: arr.length, delta: arr.length >= 2 ? arr[arr.length - 1] - arr[0] : null };
  });
  const trackNotes = tr.filter(t => t.notes && t.notes.trim()).map(t => ({ date: t.date, text: t.notes.trim() }));
  let joints = '';
  tr.forEach(t => { if (t.joints && (JRANK[t.joints] || 0) >= (JRANK[joints] || 0)) joints = t.joints; });
  const lifts = [];
  const seen = {};
  Object.keys(pd.plan.workouts).forEach(wk => (pd.plan.workouts[wk].exercises || []).forEach(e => {
    if (seen[e.key] || !hasLoadField(e)) return;
    seen[e.key] = 1;
    const l = loadLog(e.key, ds).filter(x => x.date >= pd.start);
    if (l.length) lifts.push({ key: e.key, name: e.name, first: l[0], last: l[l.length - 1], n: l.length, delta: l[l.length - 1].v - l[0].v });
  }));
  return { planned, done, notes, trackNotes, meas, meals, joints, lifts, trackCount: tr.length,
    waistDelta: meas.waist ? meas.waist.delta : null, weightDelta: meas.weight ? meas.weight.delta : null, period: per };
}
const sgn = (n, d) => (n > 0 ? '+' : '') + n.toFixed(d == null ? 1 : d);
function touchSection(ds, canEdit) {
  const id = 'tb_' + ds;
  if (!S.docs[id]) S.docs[id] = { date: ds, answers: {}, text: '', submitted: false, recs: [] };
  const doc = S.docs[id];
  const sum = touchSummary(ds);
  const box = h('div', { class: 'sub' });
  const mealAvg = () => sum.meals.days ? { k: Math.round(sum.meals.kcal / sum.meals.days), p: Math.round(sum.meals.protein / sum.meals.days), pk: Math.round(sum.meals.pKcal / sum.meals.days), pp: Math.round(sum.meals.pProtein / sum.meals.days) } : null;
  const render1 = () => {
    box.replaceChildren(h('h3', null, 'Touch base'));
    const pct = sum.planned ? Math.round(sum.done / sum.planned * 100) : 0;
    box.append(h('div', { class: 'facts' },
      h('div', { class: 'fact' }, h('b', null, sum.done + '/' + sum.planned), h('span', null, 'sessions done')),
      h('div', { class: 'fact' }, h('b', null, pct + '%'), h('span', null, 'completion')),
      h('div', { class: 'fact' }, h('b', null, sum.weightDelta == null ? '—' : sgn(sum.weightDelta) ), h('span', null, 'kg change'))));
    const rows = MEAS.filter(m => sum.meas[m[0]]).map(m => { const x = sum.meas[m[0]]; return h('tr', null, h('td', null, m[1]), h('td', null, x.first + ' ' + m[2]), h('td', null, x.n > 1 ? x.last + ' ' + m[2] : '—'), h('td', null, x.delta == null ? '—' : sgn(x.delta) + ' ' + m[2])); });
    if (rows.length) box.append(h('table', { class: 'mini meas' }, h('thead', null, h('tr', null, h('th', null, 'Measure'), h('th', null, 'First'), h('th', null, 'Latest'), h('th', null, 'Change'))), h('tbody', null, rows)));
    if (sum.lifts.length) box.append(h('table', { class: 'mini meas' }, h('thead', null, h('tr', null, h('th', null, 'Lift'), h('th', null, 'First'), h('th', null, 'Latest'), h('th', null, 'Change'))),
      h('tbody', null, sum.lifts.map(l => h('tr', null, h('td', null, l.name.replace(/ \(.*$/, '')), h('td', null, l.first.v + ' lb'), h('td', null, l.n > 1 ? l.last.v + ' lb' : '\u2014'), h('td', null, l.n > 1 ? sgn(l.delta) + ' lb' : '\u2014'))))));
    const ma = mealAvg();
    box.append(h('p', { class: 'daynote' }, ma ? h('span', null, h('b', null, 'Menu'), 'Fully logged days: ' + sum.meals.days + '. Average ' + fmtNum(ma.k) + ' kcal and ' + ma.p + ' g protein a day, plan ' + fmtNum(ma.pk) + ' kcal and ' + ma.pp + ' g.') : h('span', null, h('b', null, 'Menu'), 'No fully logged day yet. Only days with every meal ticked are compared with the plan, so partly logged days do not look like under-eating.')));
    const all = sum.notes.map(n => ({ k: 'Day', date: n.date, text: n.text })).concat(sum.trackNotes.map(n => ({ k: 'Tracking', date: n.date, text: n.text })));
    if (all.length) box.append(h('details', { class: 'dd' }, h('summary', null, 'Notes included in this review (' + all.length + ')'),
      h('div', { class: 'allnotes' }, all.map(n => h('div', { class: 'daynote' }, h('b', null, n.k + ' · ' + fmtShort(n.date)), h('div', { class: 'ntext' }, n.text))))));
    box.append(h('p', { class: 'muted small' }, 'Included: ' + sum.done + ' of ' + sum.planned + ' sessions, ' + sum.notes.length + ' daily notes, ' + sum.trackCount + ' tracking entries (' + sum.trackNotes.length + ' with notes), ' + sum.meals.days + ' fully logged menu days, ' + sum.lifts.length + ' lifts with logged weights, joints ' + (sum.joints || 'not set') + '.'));
    if (doc.submitted) { showResult(); return; }
    const q = (label, key, opts) => h('div', { class: 'q' }, h('b', null, label), seg(opts, () => doc.answers[key], v => { doc.answers[key] = v; persist(id); }));
    box.append(
      q('How was the load?', 'difficulty', [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']]),
      q('Recovery between sessions', 'recovery', [['fresh', 'Fresh'], ['ok', 'OK'], ['tired', 'Tired and sore']]),
      q('Joints', 'joints', [['Fine', 'No issues'], ['Tight', 'Tight'], ['Painful', 'Painful']]),
      q('Menu followed', 'nutrition', [['mostly', 'Mostly'], ['partly', 'Partly'], ['rarely', 'Rarely']]),
      noteField({ id: 'tb-text', label: 'Anything else', placeholder: 'Anything else: what to change, what hurts, what is missing', disabled: !canEdit, value: doc.text || '', onInput: v => { doc.text = v; persist(id); } }),
      h('div', null, h('button', { class: 'btn accent sm', type: 'button', disabled: !canEdit, onclick: submit }, 'Get recommendations')));
  };
  const showResult = () => {
    box.append(h('h3', null, 'Recommendations'), h('ul', { class: 'recs' }, doc.recs.map(r => h('li', null, r))));
    if (doc.coach) box.append(h('div', { class: 'note-coach' }, doc.coach));
    box.append(h('div', { class: 'acts' },
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { doc.submitted = false; persist(id); refreshCalendar(); render1(); } }, 'Edit answers'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { S.prefill = 'Check-in ' + fmtShort(ds) + ': ' + (doc.text || ''); C = newConsult(); closeModal(); go('consult'); } }, 'Reconsult with these notes')));
  };
  const submit = async () => {
    const a = doc.answers;
    if (!a.difficulty || !a.recovery || !a.joints || !a.nutrition) { toast('Answer the four questions first'); return; }
    if ((doc.text || '').length > NOTE_MAX) { toast('Shorten your note to ' + NOTE_MAX + ' characters first'); return; }
    const text = [doc.text].concat(sum.notes.map(n => n.text), sum.trackNotes.map(n => n.text)).filter(Boolean).join('. ');
    const areas = Object.keys(WO.detectFlags(text));
    const joints = (JRANK[sum.joints] || 0) > (JRANK[a.joints] || 0) ? sum.joints : a.joints;
    let recs = WO.buildRecs({ planned: sum.planned, done: sum.done, difficulty: a.difficulty, recovery: a.recovery, joints, nutrition: a.nutrition, waistDelta: sum.waistDelta, weightDelta: sum.weightDelta, goalType: WO.GOALS[P().plan.goal.key].type, areas });
    const ma = mealAvg(), extra = [];
    if (ma) {
      if (ma.p < ma.pp * 0.85) extra.push('Logged protein averaged ' + ma.p + ' g a day against about ' + ma.pp + ' g planned. Close that gap before changing anything else.');
      if (ma.k < ma.pk * 0.9) extra.push('Logged intake averaged ' + fmtNum(ma.k) + ' kcal against about ' + fmtNum(ma.pk) + ' planned. Results depend on eating the target, so judge the plan only after you hit it.');
      else if (ma.k > ma.pk * 1.1) extra.push('Logged intake averaged ' + fmtNum(ma.k) + ' kcal, above the ' + fmtNum(ma.pk) + ' planned. Check your waist trend before assuming the plan needs changing.');
    }
    const tracked = sum.lifts.filter(l => l.n >= 2);
    if (tracked.length >= 2) {
      const up = tracked.filter(l => l.delta > 0), best = up.slice().sort((x, y) => y.delta - x.delta)[0];
      if (up.length) extra.push('Weights are up on ' + up.length + ' of ' + tracked.length + ' tracked lifts since your first log (largest: ' + best.name.replace(/ \(.*$/, '') + ' ' + sgn(best.delta) + ' lb). Keep adding in small steps.');
      else if (sum.planned && sum.done / sum.planned >= 0.8) extra.push('No tracked lift has gone up despite good attendance. Add the smallest increment on two lifts where the last set felt easy.');
    }
    if (extra.length) recs = recs.filter(r => r.indexOf('Nothing needs to change') !== 0).concat(extra);
    doc.recs = recs;
    doc.submitted = true; doc.submittedAt = Date.now(); doc.coach = '';
    persist(id); refreshCalendar(); render1();
    const hasData = text.trim().length > 3 || Object.keys(sum.meas).length || ma || sum.lifts.length;
    if (hasData) {
      const wait = h('p', { class: 'muted small' }, 'Reading your notes…'); box.append(wait);
      const facts = { sessions_done: sum.done, sessions_planned: sum.planned, answers: a, measurements: sum.meas, lifts_lb: sum.lifts.map(l => ({ lift: l.name, first: l.first.v, latest: l.last.v, logs: l.n })), joints_from_tracking: sum.joints || null, menu_logged: ma ? { days: sum.meals.days, avg_kcal: ma.k, plan_kcal: ma.pk, avg_protein: ma.p, plan_protein: ma.pp } : null };
      const lines = sum.notes.map(n => 'Day note ' + n.date + ': ' + n.text).concat(sum.trackNotes.map(n => 'Tracking note ' + n.date + ': ' + n.text));
      const r = await askAI('You are a strength coach. A client finished a two-week check-in. Data: ' + JSON.stringify(facts) + '\nClient note: ' + (doc.text || '(none)') + '\n' + lines.join('\n') + '\nReturn ONLY JSON {"note": string}: at most 45 words, specific to what they wrote and measured, plain language, no diagnosis.');
      wait.remove();
      if (r && typeof r.note === 'string' && r.note.trim() && doc.submitted) { doc.coach = r.note.trim().slice(0, 400); persist(id); if (box.isConnected) render1(); }
    }
  };
  render1();
  return box;
}

/* ---------- day page ---------- */
function viewDay(ds) {
  const pd = P(), plan = pd.plan, date = parseYmd(ds);
  const entry = WO.entryFor(plan, date);
  const n = diffDays(parseYmd(pd.start), date);
  const tds = todayStr();
  const editable = ds <= tds && n >= 0;
  const doc = ensureDay(ds);
  const w = entry.kind === 'rest' ? null : plan.workouts[entry.ref];
  const saveDay = () => { refreshDone(ds, doc); persist('d_' + ds); updateProgress(); };

  const barI = h('i'), bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, barI);
  const meta = h('div', { class: 'meta' });
  const msg = h('div');
  function updateProgress() {
    const pr = WO.dayProgress(plan, entry, doc);
    barI.style.width = pr.pct + '%'; bar.setAttribute('aria-valuenow', String(pr.pct));
    bar.classList.toggle('full', pr.complete);
    meta.replaceChildren(h('span', null, entry.kind === 'rest' ? 'Recovery day' : pr.done + ' of ' + pr.total + ' steps'), h('span', null, entry.kind === 'rest' ? '' : pr.pct + '%'));
    msg.replaceChildren();
    if (!editable) msg.append(h('div', { class: 'banner-msg' }, n < 0 ? 'Before your program started. View only.' : 'Preview. Opens on ' + DOW[date.getDay()] + '.'));
    else if (pr.complete) msg.append(h('div', { class: 'banner-msg ok' }, 'Day complete. Nice work.'));
  }
  const head = h('section', { class: 'card' },
    h('div', { class: 'eyebrow' }, fmtLong(ds) + (ds === tds ? ' · Today' : '')),
    h('h1', { class: 'page' }, entry.kind === 'rest' ? 'Rest day' : entry.title.replace(/^Workout /, 'Workout ') + (entry.kind === 'workout' ? ': ' + entry.focus : '')),
    entry.kind === 'rest' ? h('p', { class: 'lead' }, 'No training today. Eat, hydrate and sleep well.') : null,
    entry.kind !== 'rest' && plan.cautions && plan.cautions.length ? h('div', { class: 'notice' }, plan.cautions.slice(0, 2).map(c => h('span', null, c))) : null,
    entry.kind !== 'rest' ? h('div', { class: 'progress' }, bar, meta) : null,
    msg);

  const timedControl = (it, cb) => {
    const t = parseTimed(it.text);
    if (!t) return null;
    const btn = h('button', { class: 'tbtn', type: 'button', disabled: !editable });
    const lab = h('span', { class: 'tcnt' });
    let tick = null, end = 0;
    const cnt = () => doc.cnt[it.id] || 0;
    const stop = () => { if (tick) { clearInterval(tick); tick = null; } btn.classList.remove('run'); };
    const paint = () => {
      stop();
      const full = cnt() >= t.n;
      lab.textContent = t.n > 1 ? cnt() + '/' + t.n : '';
      btn.classList.toggle('done', full);
      btn.textContent = full ? 'Done' : t.secs ? (t.n > 1 ? 'Start hold ' : 'Start ') + fmtSecs(t.secs) : 'Set done';
    };
    const bump = () => {
      doc.cnt[it.id] = cnt() + 1;
      if (cnt() >= t.n) { doc.checks[it.id] = true; cb.checked = true; }
      saveDay(); paint();
      try { if (navigator.vibrate) navigator.vibrate(200); } catch (e) { /* ignore */ }
    };
    btn.addEventListener('click', () => {
      if (!editable || cnt() >= t.n) return;
      if (!t.secs) { bump(); return; }
      if (tick) { paint(); return; }
      end = Date.now() + t.secs * 1000;
      btn.classList.add('run');
      const upd = () => {
        const left = Math.ceil((end - Date.now()) / 1000);
        if (left <= 0) { stop(); bump(); return; }
        btn.textContent = clock(left) + ' \u00B7 tap to cancel';
      };
      upd(); tick = addTimer(setInterval(upd, 250));
    });
    paint();
    return { el: h('div', { class: 'timed' }, btn, lab), paint, stop, n: t.n };
  };
  const checkList = (items, timed) => h('ul', { class: 'checks' }, items.map(it => {
    let tc = null;
    const cb = h('input', { type: 'checkbox', id: 'ck-' + it.id, checked: !!doc.checks[it.id], disabled: !editable, onchange: e => {
      doc.checks[it.id] = e.target.checked;
      if (tc) { tc.stop(); doc.cnt[it.id] = e.target.checked ? tc.n : 0; tc.paint(); }
      saveDay();
    } });
    tc = timed ? timedControl(it, cb) : null;
    return h('li', null, h('label', null, cb, h('span', null, it.text)), tc ? tc.el : null);
  }));

  const blocks = [h('div', { class: 'topbar' }, backBtn()), head];
  if (w) {
    blocks.push(sectionCard('Warm-up', checkList(w.warmup, true)));
    if (w.kind === 'swim') blocks.push(sectionCard('Swim', checkList(w.blocks)));
    else blocks.push(sectionCard('Workout', h('div', null, w.exercises.map(ex => exRow(ex, doc, editable, saveDay, ds)))));
    blocks.push(sectionCard('Stretches', checkList(w.stretches, true)));
  }
  blocks.push(fuelCard(ds, doc, editable));
  blocks.push(feedbackCard(ds, doc, editable));
  blocks.push(h('div', { class: 'topbar' }, backBtn()));
  updateProgress();
  return h('div', { style: 'display:flex;flex-direction:column;gap:22px' }, blocks);
}
function exRow(ex, doc, editable, onChange, ds) {
  const id = ex.id;
  const sets = () => doc.sets[id] || 0;
  const box = h('button', { class: 'setbox', type: 'button' });
  const counter = h('div', { class: 'ex-count' });
  const undo = h('button', { class: 'undo', type: 'button' }, 'undo');
  const row = h('div', { class: 'ex' });
  let tick = null;
  function stop() { if (tick) { clearInterval(tick); tick = null; } }
  function paint() {
    stop();
    box.replaceChildren();
    const done = sets() >= ex.sets;
    box.className = 'setbox' + (done ? ' complete' : '');
    row.className = 'ex' + (done ? ' complete' : '');
    box.append(h('span', { class: 'num' }, done ? '✓' : String(sets() + 1)));
    box.setAttribute('aria-label', done ? ex.name + ' complete' : 'Log set ' + (sets() + 1) + ' of ' + ex.sets + ' for ' + ex.name);
    counter.textContent = sets() + '/' + ex.sets;
    counter.className = 'ex-count' + (done ? ' full' : '');
    undo.style.display = sets() > 0 && !done ? '' : 'none';
  }
  function countdown(totalMs, remainMs) {
    stop();
    box.className = 'setbox counting';
    const fill = h('span', { class: 'fill' });
    fill.style.animationDuration = (totalMs / 1000) + 's';
    fill.style.animationDelay = '-' + ((totalMs - remainMs) / 1000) + 's';
    const num = h('span', { class: 'num' });
    box.replaceChildren(fill, num);
    const end = Date.now() + remainMs;
    const upd = () => {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left <= 0) { paint(); return; }
      num.textContent = String(left);
    };
    upd();
    tick = addTimer(setInterval(upd, 250));
    undo.style.display = '';
  }
  let ldIn = null;
  const pv = hasLoadField(ex) ? prevLoad(ex.key, doc.date) : null;
  const ldVal = () => { const n = parseFloat(ldIn && ldIn.value); return !isNaN(n) && n > 0 && n <= 1000 ? n : null; };
  box.addEventListener('click', () => {
    if (!editable) { toast('This day is view only'); return; }
    if (sets() >= ex.sets || box.classList.contains('counting')) return;
    if (ldIn && doc.loads[ex.key] === undefined && ldVal() != null) doc.loads[ex.key] = ldVal();
    doc.sets[id] = sets() + 1; doc.last[id] = Date.now();
    counter.textContent = sets() + '/' + ex.sets;
    onChange();
    if (sets() >= ex.sets) paint(); else countdown(ex.rest * 1000, ex.rest * 1000);
  });
  undo.addEventListener('click', () => {
    if (!editable || sets() <= 0 || sets() >= ex.sets) return;
    doc.sets[id] = sets() - 1; delete doc.last[id];
    onChange(); paint();
  });
  paint();
  const resume = doc.last[id] ? (doc.last[id] + ex.rest * 1000) - Date.now() : 0;
  if (editable && sets() < ex.sets && resume > 500) countdown(ex.rest * 1000, resume);
  const meta = [h('span', null, h('b', null, ex.sets + ' × ' + ex.reps)), h('span', null, ex.weight), h('span', null, 'Rest ' + (ex.rest >= 120 ? Math.round(ex.rest / 60 * 10) / 10 + ' min' : ex.rest + ' s'))];
  let ldField = null;
  if (hasLoadField(ex)) {
    const cur = typeof doc.loads[ex.key] === 'number' ? doc.loads[ex.key] : (pv ? pv.v : '');
    ldIn = h('input', { type: 'number', inputmode: 'decimal', step: '0.5', min: '0', max: '1000', id: 'ld-' + ex.key, 'aria-label': ex.name + ' top weight in lb', value: cur, disabled: !editable,
      oninput: e => { const n = parseFloat(e.target.value); if (isNaN(n) || n <= 0 || n > 1000) delete doc.loads[ex.key]; else doc.loads[ex.key] = n; onChange(); },
      onblur: () => { if (typeof doc.loads[ex.key] === 'number') ldIn.value = doc.loads[ex.key]; else if (ldIn.value !== '') ldIn.value = ''; } });
    ldField = h('div', { class: 'ld' }, h('label', { for: 'ld-' + ex.key }, 'Top weight used'), ldIn, h('span', null, 'lb'),
      pv ? h('span', { class: 'last' }, 'Last: ' + pv.v + ' lb on ' + fmtShort(pv.date)) : null);
  }
  row.append(
    h('div', { class: 'ex-side' }, box, counter, undo),
    h('div', { class: 'ex-main' }, h('h3', null, ex.name), h('div', { class: 'ex-meta' }, meta), ldField, ex.note ? h('div', { class: 'ex-note' }, ex.note) : null));
  return row;
}
function fuelCard(ds, doc, editable) {
  const menu = P().plan.menus[parseYmd(ds).getDay()];
  const logged = h('span', { class: 'chip' });
  const upd = () => {
    let k = 0, p = 0;
    menu.meals.forEach(m => { if (doc.meals[m.slot]) { const v = mealVal(doc, m); k += v.kcal; p += v.protein; } });
    logged.textContent = 'Eaten ' + fmtNum(Math.round(k)) + ' kcal · ' + Math.round(p) + ' g';
  };
  const rows = menu.meals.map(m => {
    const row = h('div', { class: 'meal' + (doc.meals[m.slot] ? ' eaten' : '') });
    const reset = h('button', { class: 'undo', type: 'button', onclick: () => { delete doc.mealVals[m.slot]; kIn.value = m.kcal; pIn.value = m.protein; persist('d_' + ds); sync(); upd(); } }, 'plan values');
    const sync = () => { reset.style.display = mealVal(doc, m).edited ? '' : 'none'; };
    const mk = (key, max, unit) => h('input', { type: 'number', inputmode: 'decimal', min: '0', max: String(max), step: '1', 'aria-label': m.label + ' ' + unit, value: mealVal(doc, m)[key], disabled: !editable,
      oninput: e => {
        const n = parseFloat(e.target.value), o = doc.mealVals[m.slot] = doc.mealVals[m.slot] || {};
        if (isNaN(n) || n < 0 || n > max) delete o[key]; else o[key] = n;
        if (!Object.keys(o).length) delete doc.mealVals[m.slot];
        persist('d_' + ds); sync(); upd();
      },
      onblur: e => { e.target.value = mealVal(doc, m)[key]; } });
    const kIn = mk('kcal', 5000, 'kcal'), pIn = mk('protein', 500, 'protein grams');
    sync();
    row.append(
      h('input', { type: 'checkbox', id: 'm-' + m.slot, 'aria-label': m.label + ': ' + m.title, checked: !!doc.meals[m.slot], disabled: !editable,
        onchange: e => { doc.meals[m.slot] = e.target.checked; row.classList.toggle('eaten', e.target.checked); persist('d_' + ds); upd(); } }),
      h('div', null,
        h('div', { class: 't' }, h('b', null, m.title), h('span', { class: 'time' }, m.label + ' · ' + m.time)),
        h('ul', null, m.items.map(i => h('li', null, i.text))),
        h('div', { class: 'mk2' }, kIn, h('span', null, 'kcal'), pIn, h('span', null, 'g protein'), reset)));
    return row;
  });
  upd();
  return sectionCard('Fuel', h('div', null,
    h('div', { class: 'fuel-totals' }, chip('Plan ' + fmtNum(menu.kcal) + ' kcal'), chip(menu.protein + ' g protein'), logged),
    h('p', { class: 'muted small' }, 'Tick what you ate. If a meal was different, edit its kcal and protein.'), rows),
  null);
}
function feedbackCard(ds, doc, editable) {
  const note = h('div', { class: 'saved-note' });
  let t = null;
  const nf = noteField({ id: 'fb', label: 'Feedback for this day', placeholder: 'Too easy, too hard, something hurting, a swap you want, how you slept', value: doc.feedback || '', disabled: !editable,
    onInput: v => { doc.feedback = v; note.textContent = ''; clearTimeout(t); t = setTimeout(() => { persist('d_' + ds); note.textContent = 'Saved'; }, 700); } });
  return sectionCard('How did it go?', h('div', null, nf, note));
}

/* ---------- consultation ---------- */
function newConsult() {
  const base = clone(P().profile || WO.DEFAULT_PROFILE);
  const bf = latestMeasure('bodyfat');
  if (bf != null) base.bodyFat = bf;
  if (S.prefill) { base.notes = ((base.notes ? base.notes + '\n' : '') + S.prefill).trim(); S.prefill = ''; }
  return { step: 'form', values: base, answers: {}, ai: null, askedFor: null, questions: [], plan: null, busy: false, error: '' };
}
let C = null;

function viewConsult() {
  if (!C) C = newConsult();
  if (C.step === 'questions') return viewQuestions();
  if (C.step === 'review') return viewReview();
  return viewForm();
}
function field(id, label, control, hint, full) {
  return h('div', { class: 'field' + (full ? ' full' : '') }, h('label', { for: id }, label), control, hint ? h('div', { class: 'hint' }, hint) : null);
}
function viewForm() {
  const v = C.values;
  const num = (id, val, min, max, step) => h('input', { type: 'number', id, inputmode: 'decimal', min, max, step: step || '1', value: val == null ? '' : val });
  const sel = (id, opts, val) => h('select', { id }, opts.map(o => h('option', { value: o[0], selected: String(o[0]) === String(val) }, o[1])));
  const err = h('div', { class: 'err', role: 'alert' }, C.error || '');
  const btn = h('button', { class: 'btn accent', type: 'button' }, 'Consult');
  const read = () => ({
    age: parseFloat($('#f-age').value), sex: $('#f-sex').value, weight: parseFloat($('#f-weight').value), height: parseFloat($('#f-height').value),
    experience: $('#f-exp').value, strengthDays: parseInt($('#f-days').value, 10), swimDays: parseInt($('#f-swim').value, 10),
    goal: $('#f-goal').value, bodyFat: $('#f-bf').value === '' ? null : parseFloat($('#f-bf').value),
    limits: $('#f-limits').value, notes: $('#f-notes').value,
  });
  btn.addEventListener('click', async () => {
    const val = read();
    C.values = val;
    let msg = '';
    if (!(val.age >= 18)) msg = 'WORKitOUT plans are written for adults aged 18 or over.';
    else if (val.age > 80) msg = 'Enter an age between 18 and 80.';
    else if (!(val.weight >= 35 && val.weight <= 250)) msg = 'Enter a weight between 35 and 250 kg.';
    else if (!(val.height >= 120 && val.height <= 230)) msg = 'Enter a height between 120 and 230 cm.';
    else if (val.bodyFat != null && !(val.bodyFat >= 4 && val.bodyFat <= 50)) msg = 'Body fat should be between 4 and 50 percent, or left empty.';
    if (!msg && (val.limits.length > NOTE_MAX || val.notes.length > NOTE_MAX)) msg = 'Shorten Limits and Anything else to ' + NOTE_MAX + ' characters each. Nothing was cut.';
    err.textContent = msg;
    if (msg) return;
    btn.disabled = true; btn.textContent = 'Reviewing your details…';
    await runConsult();
  });
  const form = h('div', { class: 'form-grid' },
    h('div', { class: 'group-title' }, 'About you'),
    field('f-age', 'Age', num('f-age', v.age, 18, 80)),
    field('f-sex', 'Sex', sel('f-sex', [['male', 'Male'], ['female', 'Female']], v.sex)),
    field('f-weight', 'Weight (kg)', num('f-weight', v.weight, 35, 250, '0.1')),
    field('f-height', 'Height (cm)', num('f-height', v.height, 120, 230)),
    field('f-bf', 'Body fat % (optional)', num('f-bf', v.bodyFat, 4, 50, '0.5'), 'A rough estimate is fine.'),
    field('f-exp', 'Training experience', sel('f-exp', Object.keys(WO.EXPERIENCE).map(k => [k, WO.EXPERIENCE[k]]), v.experience)),
    h('div', { class: 'group-title' }, 'Your week'),
    field('f-days', 'Strength days', sel('f-days', [[3, '3 days'], [4, '4 days'], [5, '5 days']], v.strengthDays)),
    field('f-swim', 'Swim sessions', sel('f-swim', [[0, 'None'], [1, '1 per week'], [2, '2 per week']], v.swimDays)),
    field('f-goal', 'Main goal', sel('f-goal', Object.keys(WO.GOALS).map(k => [k, WO.GOALS[k].label]), v.goal), null, true),
    h('div', { class: 'group-title' }, 'Limits and notes'),
    field('f-limits', 'Limits', noteField({ id: 'f-limits', label: 'Limits', placeholder: 'Injuries, pain, movements to avoid', value: v.limits || '' }), 'Body areas that hurt or feel tight.', true),
    field('f-notes', 'Anything else', noteField({ id: 'f-notes', label: 'Anything else', placeholder: 'Food preferences or restrictions, schedule, equipment, what you want to change', value: v.notes || '' }), null, true));
  return h('div', { style: 'display:flex;flex-direction:column;gap:22px' },
    h('div', { class: 'topbar' }, backBtn()),
    h('section', { class: 'card' }, h('div', { class: 'eyebrow' }, 'Reconsult'), h('h1', { class: 'page' }, 'Consultation'), h('p', { class: 'lead' }, 'Update your details and get a fresh plan. Nothing changes until you confirm.'), h('div', { style: 'margin-top:20px' }, form), err,
      h('div', { class: 'row' }, btn, h('button', { class: 'btn ghost', type: 'button', onclick: () => go('home') }, 'Back'))));
}
const $ = (s, el) => (el || document).querySelector(s);

async function runConsult() {
  const v = C.values;
  const seenKey = (v.limits || '') + '|' + (v.notes || '');
  const answersText = Object.values(C.answers).filter(Boolean).join('. ');
  if (C.askedFor !== seenKey) {
    const rq = WO.ruleQuestions(v);
    C.ai = await aiReview(v, answersText);
    const aiq = (C.ai ? C.ai.questions : []).map((q, i) => ({ id: 'q_ai' + i, q }));
    const qs = rq.concat(aiq).filter(q => !C.answers[q.id]).slice(0, 3);
    C.askedFor = seenKey;
    if (qs.length) { C.questions = qs; C.step = 'questions'; render(); return; }
  }
  buildReview();
}
function loadsFromPlan(plan) {
  const m = {};
  Object.values(plan.workouts).forEach(w => (w.exercises || []).forEach(e => {
    if (!e.weight) return;
    m[e.key] = e.weight;
    if (hasLoadField(e)) { const l = loadLog(e.key); if (l.length) m[e.key] = withNumber(e.weight, l[l.length - 1].v); }
  }));
  return m;
}
function buildReview() {
  const ctx = {
    prevLoads: loadsFromPlan(P().plan),
    answersText: Object.values(C.answers).filter(Boolean).join('. '),
    aiAreas: C.ai ? C.ai.areas : [], aiDiet: C.ai ? C.ai.diet : [], aiCalAdj: C.ai ? C.ai.calorie_adjust : 0, coachNote: C.ai ? C.ai.coach_note : '',
  };
  C.plan = WO.generatePlan(C.values, ctx);
  C.step = 'review'; render();
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}
function viewQuestions() {
  const tas = C.questions.map(q => h('div', { class: 'q' }, h('label', { for: q.id }, h('b', null, q.q)),
    noteField({ id: q.id, label: q.q, value: C.answers[q.id] || '', placeholder: 'Your answer', minH: '72px' })));
  const collect = () => C.questions.forEach(q => { const t = document.getElementById(q.id); if (t && t.value.trim()) C.answers[q.id] = t.value; });
  return h('div', { style: 'display:flex;flex-direction:column;gap:22px' },
    h('div', { class: 'topbar' }, h('button', { class: 'btn ghost back', type: 'button', onclick: () => { collect(); C.step = 'form'; render(); } }, icon('left'), 'Edit details')),
    h('section', { class: 'card' }, h('div', { class: 'eyebrow' }, 'A few questions'), h('h1', { class: 'page' }, 'Before I build it'), h('p', { class: 'lead' }, 'These answers change what goes into your plan. Skip any you like.'),
      h('div', { class: 'qlist' }, tas),
      h('div', { class: 'row' },
        h('button', { class: 'btn accent', type: 'button', onclick: () => { collect(); buildReview(); } }, 'Generate plan'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => buildReview() }, 'Skip'))));
}
function viewReview() {
  const plan = C.plan;
  const sched = h('table', { class: 'mini' }, h('tbody', null, plan.schedule.map((s, i) => h('tr', null, h('td', null, DOW3[i]), h('td', null, h('b', null, s.title), s.kind === 'rest' ? '' : ' · ' + s.focus)))));
  const wk = Object.keys(plan.workouts).filter(k => plan.workouts[k].kind === 'workout').map(k => {
    const w = plan.workouts[k];
    return h('details', { class: 'dd' }, h('summary', null, 'Workout ' + k + ': ' + w.title),
      h('ul', null, w.exercises.map(e => h('li', null, e.name + ', ' + e.sets + ' × ' + e.reps + (e.weight && e.weight !== 'Bodyweight' ? ' (' + e.weight + ')' : '')))));
  });
  const swimD = plan.workouts.W ? h('details', { class: 'dd' }, h('summary', null, plan.workouts.W.title), h('ul', null, plan.workouts.W.blocks.map(b => h('li', null, b.text)))) : null;
  const sample = plan.menus[1];
  const menuD = h('details', { class: 'dd' }, h('summary', null, 'Sample menu: Monday, ' + fmtNum(sample.kcal) + ' kcal, ' + sample.protein + ' g protein'),
    h('ul', null, sample.meals.map(m => h('li', null, m.label + ': ' + m.title))));
  const wipe = () => {
    openModal([
      h('h2', null, 'Replace your program?'),
      h('p', null, 'This replaces your existing program everywhere in the app: schedule, workouts, menus and check-ins. Your calendar restarts from today. Days you already completed stay green.'),
      h('div', { class: 'acts' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: closeModal }, 'Cancel'),
        h('button', { class: 'btn accent sm', type: 'button', onclick: apply }, 'Yes, replace program')),
    ], 'Confirm replace');
  };
  const apply = () => {
    const today = todayStr();
    S.docs.plan = { plan: C.plan, profile: clone(C.values), start: today, createdAt: new Date().toISOString(), isDefault: false };
    if (S.docs['d_' + today]) { delete S.docs['d_' + today]; persist('d_' + today); }
    persist('plan');
    const d = new Date(); calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    closeModal(); C = null;
    toast('Program updated');
    go('home');
  };
  return h('div', { style: 'display:flex;flex-direction:column;gap:22px' },
    h('div', { class: 'topbar' }, h('button', { class: 'btn ghost back', type: 'button', onclick: () => { C.step = 'form'; render(); } }, icon('left'), 'Edit details')),
    h('section', { class: 'card' },
      h('div', { class: 'eyebrow' }, 'Your new plan'), h('h1', { class: 'goal' }, plan.goal.label), h('p', { class: 'lead' }, plan.goal.line),
      h('div', { class: 'chips' }, chip(plan.stats.strengthDays + ' strength'), plan.stats.swimDays ? chip(plan.stats.swimDays + ' swim') : null, chip(plan.stats.restDays + ' rest'), chip('~' + fmtNum(plan.stats.kcal) + ' kcal'), chip('~' + plan.stats.protein + ' g protein')),
      h('ul', { class: 'guides' }, plan.guidelines.map(g => h('li', null, g))),
      plan.cautions.length ? h('div', { class: 'notice' }, plan.cautions.map(c => h('span', null, c))) : null,
      plan.coachNote ? h('div', { class: 'note-coach' }, h('b', null, 'Coach note: '), plan.coachNote) : null),
    h('section', { class: 'card' }, h('div', { class: 'sec-head' }, h('h2', { class: 'sec' }, 'Week')), sched, h('div', { style: 'margin-top:12px' }, wk, swimD, menuD)),
    h('div', { class: 'row', style: 'margin-top:0' },
      h('button', { class: 'btn accent', type: 'button', onclick: wipe }, 'Confirm plan'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { C.step = 'form'; render(); } }, 'Edit details')));
}

/* ---------- render + boot ---------- */
function render() {
  clearTimers(); closeModal();
  root.replaceChildren();
  if (!S.ready) { root.append(h('p', { class: 'muted', role: 'status' }, 'Loading your program…')); return; }
  let v;
  if (cur === 'consult') v = viewConsult();
  else if (cur === 'settings') v = viewSettings();
  else if (cur.slice(0, 4) === 'day-') v = viewDay(cur.slice(4));
  else v = viewHome();
  root.append(v);
}
let lastDay = todayStr();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.ready && todayStr() !== lastDay) { lastDay = todayStr(); if (cur === 'home' || cur.slice(0, 4) === 'day-') render(); }
});
(async function boot() {
  cur = parseHash();
  render();
  await initStore();
  ensurePlan();
  S.ready = true;
  render();
})();
window.__WO_DEBUG = { S, go, render, get C() { return C; } };
})();
