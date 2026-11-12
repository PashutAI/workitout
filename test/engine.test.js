const WO = require('../src/engine.js');
const assert = require('assert');
const p = WO.generatePlan(WO.DEFAULT_PROFILE, {});
console.log('stats', JSON.stringify(p.stats));
console.log('schedule', p.schedule.map(s => s.title + ' | ' + s.focus).join('\n  '));
for (const k of Object.keys(p.workouts)) {
  const w = p.workouts[k];
  console.log(k, w.title, (w.exercises||[]).map(e => e.name + ' ' + e.sets + 'x' + e.reps + ' @' + e.weight).join('; '));
}
p.menus.forEach((m, i) => console.log(WO.DOW[i], m.kind, 'target', m.kcalTarget, 'kcal', m.kcal, 'prot', m.protein, m.meals.map(x => x.title).join(' / ')));
console.log('Mon dinner items', JSON.stringify(p.menus[1].meals.map(m => m.items.map(i => i.text))));
console.log('cautions', p.cautions);
console.log('guidelines', p.guidelines);
// matrix
let n = 0;
for (const goal of Object.keys(WO.GOALS)) for (const days of [3,4,5]) for (const swim of [0,1,2]) for (const sex of ['male','female']) for (const exp of ['lt6','mid','adv']) {
  const prof = Object.assign({}, WO.DEFAULT_PROFILE, {goal, strengthDays: days, swimDays: swim, sex, experience: exp, weight: sex==='male'?82:60, height: sex==='male'?190:165, age: 35});
  const pl = WO.generatePlan(prof, {});
  assert.strictEqual(pl.schedule.length, 7);
  assert(pl.schedule.some(s => s.kind === 'rest'), 'needs rest');
  assert.strictEqual(pl.schedule.filter(s => s.kind==='workout').length, pl.stats.strengthDays);
  assert.strictEqual(pl.schedule.filter(s => s.kind==='swim').length, pl.stats.swimDays);
  pl.schedule.forEach(s => { if (s.kind !== 'rest') assert(pl.workouts[s.ref], 'missing workout ' + s.ref); });
  Object.values(pl.workouts).forEach(w => { if (w.kind==='workout') assert(w.exercises.length >= 2); });
  pl.menus.forEach(m => { assert(Math.abs(m.kcal - m.kcalTarget) <= 150, `kcal off ${goal} ${days} ${swim} ${sex} ${m.kcal} vs ${m.kcalTarget}`); });
  n++;
}
console.log('matrix ok', n);
// variety: lunches distinct across the week for default
const lunches = p.menus.map(m => m.meals.find(x => x.slot==='lunch').title);
console.log('distinct lunches', new Set(lunches).size, 'dinners', new Set(p.menus.map(m => m.meals.find(x => x.slot==='dinner').title)).size);
// flags
const f = WO.generatePlan(Object.assign({}, WO.DEFAULT_PROFILE, {limits:'Right shoulder pain when pressing, knee pain'}), {});
console.log('flags', f.flags, f.workouts.A.exercises.map(e=>e.name));
console.log(f.cautions);
const v = WO.generatePlan(Object.assign({}, WO.DEFAULT_PROFILE, {notes:'I am vegetarian and gluten free'}), {});
console.log('veg', v.diet, v.menus.map(m => m.meals.map(x=>x.title).join(',')).join('\n'), v.cautions.slice(-1));
console.log('questions', WO.ruleQuestions(Object.assign({}, WO.DEFAULT_PROFILE, {limits:'shoulder pain'}), {}));
