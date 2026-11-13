/* WORKitOUT engine: pure logic, no DOM. */
(function (root) {
'use strict';

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = s => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
const startOfWeek = d => addDays(d, -d.getDay());
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW3 = DOW.map(s => s.slice(0, 3));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- goals ---------- */
const GOALS = {
  chest_arms: { label: 'Build muscle: chest & arms, stay lean', short: 'Chest & arms', type: 'gain', split: 'chest_arms' },
  upper: { label: 'Build muscle: balanced upper body', short: 'Upper body', type: 'gain', split: 'upper' },
  full: { label: 'Build muscle: full body', short: 'Full body', type: 'gain', split: 'full' },
  recomp: { label: 'Body recomposition', short: 'Recomposition', type: 'recomp', split: 'full' },
  fatloss: { label: 'Lose fat, keep muscle', short: 'Fat loss', type: 'loss', split: 'full' },
  fitness: { label: 'General fitness & strength', short: 'Fitness', type: 'maint', split: 'full' },
};
const EXPERIENCE = { lt6: 'Under 6 months', mid: '6 to 24 months', adv: 'Over 2 years' };

/* ---------- exercises ---------- */
const EX = {
  bench: { name: 'Barbell bench press', sets: 4, reps: '8', rest: 150 },
  arnold: { name: 'Arnold press', sets: 3, reps: '10', rest: 90 },
  ndbpress: { name: 'Neutral-grip dumbbell press', sets: 3, reps: '10', rest: 90 },
  shpress: { name: 'Seated dumbbell shoulder press', sets: 3, reps: '10', rest: 90 },
  incline: { name: 'Incline dumbbell press', sets: 3, reps: '10', rest: 90 },
  chestpress: { name: 'Chest press machine', sets: 3, reps: '10', rest: 90 },
  pecdeck: { name: 'Pec deck fly', sets: 3, reps: '12', rest: 90, note: 'Elbows slightly bent, pads at chest height.' },
  pushdown: { name: 'Triceps pushdown (straight bar)', sets: 4, reps: '12', rest: 90 },
  ropepd: { name: 'Triceps rope pushdown', sets: 3, reps: '12', rest: 90 },
  ohext: { name: 'Overhead cable triceps extension', sets: 3, reps: '12', rest: 60 },
  lateral: { name: 'Lateral raise', sets: 3, reps: '15', rest: 60 },
  facepull: { name: 'Face pull or band pull-apart', sets: 3, reps: '15', rest: 60 },
  reardelt: { name: 'Reverse pec deck', sets: 3, reps: '15', rest: 60 },
  latpd: { name: 'Lat pulldown (wide grip)', sets: 4, reps: '10', rest: 90 },
  row: { name: 'Seated cable row', sets: 3, reps: '10', rest: 90 },
  dbrow: { name: 'One-arm dumbbell row', sets: 3, reps: '10 per side', rest: 90 },
  ezcurl: { name: 'EZ-bar curl (standing)', sets: 4, reps: '10', rest: 90 },
  hammer: { name: 'Hammer curl', sets: 3, reps: '12', rest: 60 },
  cablecurl: { name: 'Cable rope curl', sets: 3, reps: '12', rest: 60 },
  legpress: { name: 'Leg press', sets: 4, reps: '10', rest: 150, note: 'Wide stance, stop at 90 degrees, do not lock the knees.' },
  legext: { name: 'Leg extension', sets: 3, reps: '12', rest: 90, note: 'Pause one second at the top.' },
  legcurl: { name: 'Leg curl', sets: 3, reps: '12', rest: 90 },
  bridge: { name: 'Glute bridge', sets: 3, reps: '12', rest: 60 },
  goblet: { name: 'Goblet squat', sets: 3, reps: '10', rest: 90 },
  calf: { name: 'Standing calf raise', sets: 3, reps: '15', rest: 60 },
  crunch: { name: 'Floor crunch', sets: 3, reps: '15', rest: 60 },
  hkr: { name: 'Hanging knee raise', sets: 3, reps: '12', rest: 60, note: 'Too easy? Straighten the legs or hold a 5 lb weight between the feet.' },
  deadbug: { name: 'Dead bug', sets: 3, reps: '10 per side', rest: 60 },
  plank: { name: 'Plank', sets: 3, reps: '60 s hold', rest: 60 },
  ss_chest: { name: 'Chest superset: pec deck or chest press, then push-ups', sets: 3, reps: '10 + max reps', rest: 120, note: 'Do both moves back to back, then rest. Push-ups are bodyweight.', parts: [{ k: 'a', label: 'Pec deck or chest press' }] },
  ss_chest_alt: { name: 'Chest superset: chest press machine, then incline push-ups', sets: 3, reps: '10 + max reps', rest: 120, note: 'Do both moves back to back, then rest. Push-ups are bodyweight.', parts: [{ k: 'a', label: 'Chest press machine' }] },
  ss_arms: { name: 'Arms superset: EZ-bar curl, then triceps pushdown', sets: 3, reps: '10 + 10', rest: 120, note: 'Do both moves back to back, then rest.', parts: [{ k: 'a', label: 'EZ-bar curl' }, { k: 'b', label: 'Triceps pushdown' }] },
  ss_arms_alt: { name: 'Arms superset: cable rope curl, then rope pushdown', sets: 3, reps: '10 + 10', rest: 120, note: 'Do both moves back to back, then rest.', parts: [{ k: 'a', label: 'Cable rope curl' }, { k: 'b', label: 'Rope pushdown' }] }
};
/* Starting loads. Personal values can be injected through root.WO_PERSONAL (see build.js); the shipped defaults carry none. */
const PERSONAL = (root && typeof root.WO_PERSONAL === 'object' && root.WO_PERSONAL) || {};
const DEFAULT_LOADS = Object.assign({
  plank: 'Bodyweight',
  crunch: 'Bodyweight',
  hkr: 'Bodyweight',
  deadbug: 'Bodyweight',
  bridge: 'Bodyweight',
  ss_chest: 'Machine at working weight, bodyweight push-ups',
  ss_chest_alt: 'Machine at working weight, bodyweight push-ups',
  ss_arms: 'EZ bar and cable at working weights',
  ss_arms_alt: 'Light to moderate cable weight'
}, PERSONAL.loads || {});
const LOAD_HINT = 'Start light; the last 2 reps should be hard';

/* ---------- blueprints ---------- */
const BP = {
  A_chest: { title: 'Chest, shoulders & triceps', warm: 'push', ex: ['bench', 'arnold', 'pecdeck', 'pushdown', 'lateral'] },
  B_back: { title: 'Back & biceps', warm: 'pull', ex: ['latpd', 'row', 'facepull', 'ezcurl', 'hammer'] },
  C_legs: { title: 'Legs & abs', warm: 'legs', ex: ['legpress', 'legext', 'legcurl', 'crunch', 'hkr', 'plank'] },
  D_chestarms: { title: 'Chest & arms supersets', warm: 'chestarms', ex: ['ss_chest', 'ss_arms'] },
  E_shoulders: { title: 'Shoulders & upper back', warm: 'pull', ex: ['shpress', 'lateral', 'reardelt', 'dbrow', 'ohext', 'cablecurl'] },
  B_back_plus: { title: 'Back, biceps & arms finisher', warm: 'pull', ex: ['latpd', 'row', 'facepull', 'ezcurl', { k: 'ss_arms', sets: 2 }] },
  C_legs_plus: { title: 'Legs, abs & chest finisher', warm: 'legs', ex: ['legpress', 'legcurl', 'crunch', 'plank', { k: 'ss_chest', sets: 2 }] },
  U_push: { title: 'Chest, shoulders & triceps', warm: 'push', ex: ['bench', 'shpress', 'pecdeck', 'lateral', 'pushdown'] },
  U_pull: { title: 'Back, rear delts & biceps', warm: 'pull', ex: ['latpd', 'row', 'dbrow', 'facepull', 'ezcurl', 'hammer'] },
  U_mix: { title: 'Upper-body mix', warm: 'push', ex: ['incline', 'row', 'shpress', 'reardelt', 'cablecurl', 'ropepd'] },
  U_arms: { title: 'Arms & shoulders', warm: 'chestarms', ex: ['lateral', 'reardelt', 'ezcurl', 'pushdown', 'hammer', 'ohext'] },
  F1: { title: 'Full body 1', warm: 'full', ex: ['legpress', 'bench', 'latpd', 'shpress', 'plank'] },
  F2: { title: 'Full body 2', warm: 'full', ex: ['goblet', 'incline', 'row', 'lateral', 'legcurl', 'crunch'] },
  F3: { title: 'Full body 3', warm: 'full', ex: ['legpress', 'chestpress', 'dbrow', 'facepull', 'ezcurl', 'pushdown', 'hkr'] },
  FU1: { title: 'Upper body 1', warm: 'push', ex: ['bench', 'latpd', 'shpress', 'ezcurl', 'pushdown'] },
  FL1: { title: 'Lower body 1', warm: 'legs', ex: ['legpress', 'legcurl', 'legext', 'calf', 'plank'] },
  FU2: { title: 'Upper body 2', warm: 'pull', ex: ['incline', 'row', 'lateral', 'reardelt', 'hammer', 'ohext'] },
  FL2: { title: 'Lower body 2', warm: 'legs', ex: ['goblet', 'bridge', 'legcurl', 'calf', 'crunch', 'hkr'] },
  FA: { title: 'Arms, shoulders & core', warm: 'chestarms', ex: ['lateral', 'reardelt', 'ezcurl', 'pushdown', 'hammer', 'ohext', 'plank'] },
};
const SPLITS = {
  chest_arms: { 3: ['A_chest', 'B_back_plus', 'C_legs_plus'], 4: ['A_chest', 'B_back', 'C_legs', 'D_chestarms'], 5: ['A_chest', 'B_back', 'C_legs', 'D_chestarms', 'E_shoulders'] },
  upper: { 3: ['U_push', 'U_pull', 'C_legs'], 4: ['U_push', 'U_pull', 'C_legs', 'U_mix'], 5: ['U_push', 'U_pull', 'C_legs', 'U_mix', 'U_arms'] },
  full: { 3: ['F1', 'F2', 'F3'], 4: ['FU1', 'FL1', 'FU2', 'FL2'], 5: ['FU1', 'FL1', 'FU2', 'FL2', 'FA'] },
};
const PATTERNS = {
  '3-0': ['S1', 'R', 'S2', 'R', 'S3', 'R', 'R'],
  '3-1': ['S1', 'R', 'S2', 'R', 'S3', 'W', 'R'],
  '3-2': ['S1', 'W', 'S2', 'R', 'S3', 'W', 'R'],
  '4-0': ['S1', 'S2', 'R', 'S3', 'S4', 'R', 'R'],
  '4-1': ['S1', 'S2', 'W', 'S3', 'S4', 'R', 'R'],
  '4-2': ['S1', 'S2', 'W', 'S3', 'S4', 'W', 'R'],
  '5-0': ['S1', 'S2', 'S3', 'R', 'S4', 'S5', 'R'],
  '5-1': ['S1', 'S2', 'W', 'S3', 'S4', 'S5', 'R'],
};

/* ---------- warm-ups and stretches ---------- */
const WARM = {
  push: ['3 min general warm-up (bike or brisk walk)', 'Band pull-apart, 2 x 15', 'Arm circles, 10 small and 10 large each way', 'Wall slides, 2 x 10', 'Ramp-up set of the first press (empty bar, 10 reps)'],
  pull: ['3 min general warm-up (rower or brisk walk)', 'Band pull-apart, 2 x 15', 'Cat-cow, 10 reps', 'Straight-arm scapular pulldowns, 10 reps', 'Ramp-up set of the first pull (light, 10 reps)'],
  legs: ['5 min bike or brisk walk', 'Bodyweight squats, 2 x 10', 'Leg swings, 10 per side', 'Glute bridges, 2 x 10', 'Ramp-up set on the first lift (light, 10 reps)'],
  chestarms: ['3 min general warm-up (bike or brisk walk)', 'Band pull-apart, 2 x 15', 'Arm circles, 10 small and 10 large each way', 'Wall slides, 2 x 10', 'Light curl and pushdown set, 12 reps each'],
  full: ['4 min general warm-up (bike or brisk walk)', 'Band pull-apart, 2 x 15', 'Bodyweight squats, 2 x 10', 'Arm circles, 10 small and 10 large each way', 'Ramp-up set of the first lift (light, 10 reps)'],
  swim: ['Arm swings, 15 reps', 'Band pull-apart, 2 x 15', 'Shoulder circles, 10 each way', 'Trunk rotations, 10 per side'],
};
const STRETCH = {
  push: ['Doorway chest stretch, 2 x 30 s per arm', 'Cross-body shoulder stretch, 2 x 30 s per arm', 'Sleeper stretch (rotator cuff), 2 x 30 s per shoulder', 'Overhead triceps stretch, 2 x 30 s per arm'],
  pull: ['Lat stretch (hands on a bench, hips back), 2 x 30 s', 'Wall biceps stretch, 2 x 30 s per arm', "Child's pose with reach, 2 x 30 s", 'Upper-trap stretch, 2 x 30 s per side'],
  legs: ['Quad stretch, 2 x 30 s per leg', 'Hamstring stretch, 2 x 30 s per leg', 'Hip-flexor stretch, 2 x 30 s per side', 'Calf stretch, 2 x 30 s per leg', 'Figure-4 glute stretch, 2 x 30 s per side'],
  chestarms: ['Doorway chest stretch, 2 x 30 s per arm', 'Wall biceps stretch, 2 x 30 s per arm', 'Overhead triceps stretch, 2 x 30 s per arm', 'Wrist and forearm stretch, 2 x 20 s per arm', 'Sleeper stretch (rotator cuff), 2 x 30 s per shoulder'],
  full: ['Doorway chest stretch, 2 x 30 s per arm', 'Lat stretch (hands on a bench, hips back), 2 x 30 s', 'Hamstring stretch, 2 x 30 s per leg', 'Hip-flexor stretch, 2 x 30 s per side'],
  swim: ['Cross-body shoulder stretch, 2 x 30 s per arm', 'Overhead triceps stretch, 2 x 30 s per arm', 'Lat stretch, 2 x 30 s', 'Doorway chest stretch, 2 x 30 s per arm'],
};

/* ---------- limits and diet detection ---------- */
const FLAG_WORDS = {
  shoulder: ['shoulder', 'rotator', 'impinge', 'deltoid', 'acromio', 'collarbone', 'clavicle', 'scapula', 'כתף', 'כתפ'],
  knee: ['knee', 'patell', 'meniscus', ' acl', ' mcl', 'ברך', 'ברכ'],
  lower_back: ['lower back', 'low back', 'lumbar', 'sciatic', 'herniat', 'back pain', 'slipped disc', 'גב תחתון'],
  wrist_elbow: ['wrist', 'elbow', 'tennis elbow', 'golfer', 'forearm', 'carpal', 'מרפק', 'שורש כף'],
  neck: ['neck', 'cervical', 'צוואר'],
  hip: ['hip ', 'hips', 'groin', 'ירך'],
  ankle: ['ankle', 'achilles', 'plantar', 'קרסול'],
};
const AREA_LABEL = { shoulder: 'shoulder', knee: 'knee', lower_back: 'lower back', wrist_elbow: 'wrist or elbow', neck: 'neck', hip: 'hip', ankle: 'ankle' };
const SEVERE = ['pain', 'hurt', 'injur', 'impinge', 'tear', 'torn', 'surgery', 'herniat', 'sciatic', 'sharp', 'pinch', 'swell', 'כאב', 'פציע', 'ניתוח'];
const MILD = ['tight', 'stiff', 'sore', 'tension', 'catch', 'תפיס', 'נוקשות'];
const DETAIL_WORDS = ['since', 'weeks', 'months', 'years', 'doctor', 'physio', 'therap', 'diagnos', 'mri', 'x-ray', 'assessed', 'rehab', 'כבר', 'רופא', 'פיזיו'];
const DIET_WORDS = {
  vegan: ['vegan', 'טבעוני'],
  vegetarian: ['vegetarian', 'צמחוני'],
  pescatarian: ['pescatarian', 'pescetarian'],
  dairyfree: ['dairy-free', 'dairy free', 'lactose', 'no dairy', 'לקטוז'],
  glutenfree: ['gluten', 'celiac', 'coeliac', 'גלוטן'],
  nutfree: ['nut allergy', 'nut-free', 'nut free', 'peanut allergy', 'allergic to nuts', 'allergic to peanuts', 'אלרגיה לאגוזים'],
  eggfree: ['egg allergy', 'no eggs', 'egg-free', 'egg free', 'allergic to eggs'],
};
const DIET_EXCL = {
  vegan: ['meat', 'fish', 'dairy', 'egg'], vegetarian: ['meat', 'fish'], pescatarian: ['meat'],
  dairyfree: ['dairy'], glutenfree: ['gluten'], nutfree: ['nuts'], eggfree: ['egg'],
};
const DIET_LABEL = { vegan: 'vegan', vegetarian: 'vegetarian', pescatarian: 'pescatarian', dairyfree: 'dairy-free', glutenfree: 'gluten-free', nutfree: 'nut-free', eggfree: 'egg-free' };

function detectFlags(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  const severe = SEVERE.some(w => t.includes(w));
  const flags = {};
  Object.keys(FLAG_WORDS).forEach(a => {
    if (FLAG_WORDS[a].some(w => t.includes(w))) flags[a] = severe ? 2 : 1;
  });
  return flags;
}
function detectDiet(text) {
  const t = String(text || '').toLowerCase();
  return Object.keys(DIET_WORDS).filter(k => DIET_WORDS[k].some(w => t.includes(w)));
}

/* ---------- foods and meals ---------- */
const FOODS = {
  egg: { n: 'large egg', np: 'large eggs', unit: 'pc', k: 72, p: 6.3, step: 1, tags: ['egg'] },
  bread: { n: 'slice whole-wheat bread', np: 'slices whole-wheat bread', unit: 'pc', k: 80, p: 4, step: 1, flex: 1, tags: ['gluten'] },
  pb: { n: 'peanut butter', unit: 'tbsp', k: 95, p: 4, step: 0.5, flex: 1, tags: ['nuts'] },
  oats: { n: 'rolled oats (dry weight), cooked', unit: 'cup', k: 300, p: 10, step: 0.25, flex: 1, tags: ['gluten'] },
  yog: { n: 'high-protein Greek yogurt (0%)', unit: 'g', k: 0.63, p: 0.103, step: 25, tags: ['dairy'] },
  chicken: { n: 'chicken breast (cooked weight)', unit: 'g', k: 1.65, p: 0.31, step: 25, tags: ['meat'] },
  turkey: { n: 'lean ground turkey (cooked)', unit: 'g', k: 1.8, p: 0.27, step: 25, tags: ['meat'] },
  beef: { n: 'lean beef (cooked)', unit: 'g', k: 1.8, p: 0.28, step: 25, tags: ['meat'] },
  salmon: { n: 'salmon fillet (baked)', unit: 'g', k: 2.05, p: 0.22, step: 25, tags: ['fish'] },
  tuna: { n: 'can of tuna in water', np: 'cans of tuna in water', unit: 'pc', k: 110, p: 25, step: 1, tags: ['fish'] },
  cottage: { n: 'cottage cheese (1%)', unit: 'cup', k: 165, p: 28, step: 0.25, tags: ['dairy'] },
  rice: { n: 'cooked basmati rice', unit: 'cup', k: 205, p: 4.3, step: 0.25, flex: 1 },
  ricecake: { n: 'rice cake', np: 'rice cakes', unit: 'pc', k: 35, p: 0.7, step: 1 },
  nuts: { n: 'walnuts or almonds', unit: 'g', k: 6.2, p: 0.17, step: 5, flex: 1, tags: ['nuts'] },
  sweetpot: { n: 'baked sweet potato', unit: 'g', k: 0.9, p: 0.016, step: 25, flex: 1 },
  potato: { n: 'baked potato', unit: 'g', k: 0.93, p: 0.025, step: 25, flex: 1 },
  pasta: { n: 'cooked whole-wheat pasta', unit: 'cup', k: 175, p: 7.5, step: 0.25, flex: 1, tags: ['gluten'] },
  wrap: { n: 'whole-wheat wrap', np: 'whole-wheat wraps', unit: 'pc', k: 140, p: 5, step: 1, flex: 1, tags: ['gluten'] },
  quinoa: { n: 'cooked quinoa', unit: 'cup', k: 220, p: 8, step: 0.25, flex: 1 },
  lentils: { n: 'cooked lentils', unit: 'cup', k: 230, p: 18, step: 0.25 },
  chickpeas: { n: 'cooked chickpeas', unit: 'cup', k: 270, p: 14.5, step: 0.25 },
  edamame: { n: 'shelled edamame', unit: 'cup', k: 190, p: 18, step: 0.25 },
  tofu: { n: 'firm tofu', unit: 'g', k: 1.44, p: 0.17, step: 25 },
  avocado: { n: 'avocado', unit: 'half', k: 120, p: 1.5, step: 1, flex: 1 },
  oil: { n: 'olive oil', unit: 'tsp', k: 40, p: 0, step: 1, flex: 1 },
  salad: { n: 'large mixed salad', unit: 'serv', k: 60, p: 3 },
  veg: { n: 'vegetables (steamed, roasted or stir-fried)', unit: 'serv', k: 50, p: 3 },
  banana: { n: 'banana', np: 'bananas', unit: 'pc', k: 105, p: 1.3, step: 1 },
  apple: { n: 'apple', np: 'apples', unit: 'pc', k: 95, p: 0.5, step: 1 },
  dates: { n: 'Medjool date', np: 'Medjool dates', unit: 'pc', k: 65, p: 0.5, step: 1 },
  coffee: { n: 'black coffee', unit: 'serv', k: 0, p: 0 },
  milk: { n: 'milk (2%)', unit: 'cup', k: 122, p: 8, step: 0.25, flex: 1, tags: ['dairy'] },
  berries: { n: 'mixed berries', unit: 'cup', k: 70, p: 1, step: 0.25 },
};
const MEALS = {
  pre: [
    ['P1', 'Banana and black coffee', [['banana', 1], ['coffee', 1]]],
    ['P2', 'Apple and black coffee', [['apple', 1], ['coffee', 1]]],
    ['P3', 'Medjool dates and black coffee', [['dates', 2], ['coffee', 1]]],
  ],
  breakfast: [
    ['B1', 'Eggs, toast and peanut butter', [['egg', 3], ['bread', 2], ['pb', 1], ['veg', 1]]],
    ['B2', 'Protein oats', [['oats', 0.5], ['yog', 175], ['pb', 1], ['banana', 1]]],
    ['B3', 'Egg and avocado wrap', [['egg', 3], ['wrap', 1], ['avocado', 1], ['veg', 1]]],
    ['B4', 'Yogurt power bowl', [['yog', 250], ['nuts', 30], ['banana', 1], ['oats', 0.25]]],
    ['B5', 'Cottage cheese, toast and berries', [['cottage', 0.75], ['bread', 2], ['berries', 1]]],
    ['B6', 'Veggie omelette and fruit', [['egg', 3], ['bread', 2], ['veg', 1], ['apple', 1]]],
    ['B7', 'Yogurt, berries and nuts bowl', [['yog', 250], ['berries', 1], ['nuts', 30], ['banana', 1]]],
    ['B8', 'Egg and sweet potato hash', [['egg', 3], ['sweetpot', 200], ['veg', 1], ['avocado', 1]]],
  ],
  lunch: [
    ['L1', 'Chicken and rice bowl', [['chicken', 175], ['rice', 2], ['salad', 1], ['oil', 1]]],
    ['L2', 'Beef and pasta', [['beef', 125], ['pasta', 1.5], ['veg', 1], ['oil', 1]]],
    ['L3', 'Chicken wraps', [['chicken', 175], ['wrap', 2], ['salad', 1], ['oil', 1]]],
    ['L4', 'Tuna rice bowl', [['tuna', 1], ['egg', 2], ['rice', 1.5], ['avocado', 1], ['veg', 1]]],
    ['L5', 'Turkey and sweet potato plate', [['turkey', 175], ['sweetpot', 250], ['veg', 1], ['oil', 1]]],
    ['L6', 'Chicken and lentil stew', [['chicken', 125], ['lentils', 1], ['rice', 1], ['veg', 1]]],
    ['L7', 'Chickpea and quinoa bowl', [['chickpeas', 1], ['quinoa', 1.5], ['egg', 3], ['salad', 1], ['oil', 1]]],
    ['L8', 'Lentil, egg and rice bowl', [['lentils', 1.25], ['rice', 1.5], ['egg', 3], ['veg', 1]]],
    ['L9', 'Salmon and quinoa', [['salmon', 150], ['quinoa', 1.5], ['veg', 1], ['oil', 1]]],
  ],
  snack: [
    ['S1', 'Tuna on rice cakes', [['tuna', 1], ['ricecake', 2], ['nuts', 30]]],
    ['S2', 'Cottage cheese and apple', [['cottage', 0.75], ['apple', 1], ['nuts', 20]]],
    ['S3', 'Yogurt, banana and walnuts', [['yog', 175], ['banana', 1], ['nuts', 30]]],
    ['S4', 'Eggs and toast', [['egg', 2], ['bread', 1], ['pb', 1], ['apple', 1]]],
    ['S5', 'Edamame and rice cakes', [['edamame', 1], ['ricecake', 2], ['banana', 1]]],
    ['S6', 'Milk, banana and peanut butter', [['milk', 1], ['banana', 1], ['pb', 1]]],
  ],
  dinner: [
    ['D1', 'Cottage cheese and eggs', [['cottage', 0.75], ['egg', 2], ['bread', 2], ['salad', 1]]],
    ['D2', 'Baked salmon and rice', [['salmon', 150], ['rice', 1], ['veg', 1], ['oil', 1]]],
    ['D3', 'Lean beef and potatoes', [['beef', 125], ['potato', 250], ['veg', 1], ['oil', 1]]],
    ['D4', 'Chicken stir-fry and rice', [['chicken', 125], ['rice', 1], ['veg', 1], ['oil', 2]]],
    ['D5', 'Shakshuka-style eggs', [['egg', 3], ['bread', 2], ['veg', 1], ['cottage', 0.5]]],
    ['D6', 'Turkey burger bowl', [['turkey', 175], ['sweetpot', 200], ['salad', 1], ['avocado', 1]]],
    ['D7', 'Tofu and vegetable stir-fry', [['tofu', 250], ['rice', 1.25], ['veg', 1], ['oil', 2]]],
    ['D8', 'Salmon and sweet potato', [['salmon', 150], ['sweetpot', 250], ['veg', 1], ['oil', 1]]],
    ['D9', 'Egg-fried rice with edamame', [['egg', 3], ['rice', 1.5], ['edamame', 0.75], ['veg', 1], ['oil', 1]]],
    ['D10', 'Chickpea and sweet potato curry', [['chickpeas', 1], ['sweetpot', 250], ['rice', 0.75], ['veg', 1], ['oil', 1]]],
  ],
  evening: [
    ['E1', 'Greek yogurt and peanut butter', [['yog', 100], ['pb', 1]]],
    ['E2', 'Cottage cheese and berries', [['cottage', 0.5], ['berries', 1]]],
    ['E3', 'Milk and banana', [['milk', 1], ['banana', 1]]],
    ['E4', 'Yogurt, berries and nuts', [['yog', 100], ['berries', 0.5], ['nuts', 15]]],
    ['E5', 'Toast and peanut butter', [['bread', 1], ['pb', 1], ['milk', 0.5]]],
  ],
};
const SLOT_TIME = { pre: '07:00', breakfast: '09:00', lunch: '13:30', snack: '17:00', dinner: '20:30', evening: '22:00' };

function frac(q) {
  const whole = Math.floor(q + 1e-9);
  const r = Math.round((q - whole) * 4) / 4;
  const m = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾', 1: '' };
  let w = whole + (r === 1 ? 1 : 0);
  const f = m[r] || '';
  if (w === 0 && f) return f;
  return String(w) + f;
}
function fmtQty(id, q) {
  const f = FOODS[id];
  switch (f.unit) {
    case 'g': return Math.round(q) + ' g ' + f.n;
    case 'cup': return frac(q) + (q <= 1.001 ? ' cup ' : ' cups ') + f.n;
    case 'tbsp': return frac(q) + ' tbsp ' + f.n;
    case 'tsp': return frac(q) + ' tsp ' + f.n;
    case 'pc': return q + ' ' + (q === 1 ? f.n : (f.np || f.n));
    case 'half': return frac(q / 2) + ' ' + f.n;
    case 'scoop': return q + (q === 1 ? ' scoop ' : ' scoops ') + f.n;
    default: return f.n;
  }
}
const snap = (q, step) => Math.round(q / step) * step;
const mealTags = m => { const s = new Set(); m[2].forEach(it => (FOODS[it[0]].tags || []).forEach(t => s.add(t))); return s; };

function buildItems(def) {
  return def[2].map(it => ({ f: it[0], q: it[1], base: it[1], text: '' }));
}
function totals(items) {
  let k = 0, p = 0;
  items.forEach(it => { k += it.q * FOODS[it.f].k; p += it.q * FOODS[it.f].p; });
  return { kcal: Math.round(k), protein: Math.round(p) };
}
function fitDay(meals, target) {
  const flat = [];
  meals.forEach(m => m.items.forEach(it => { if (FOODS[it.f].flex) flat.push(it); }));
  const sum = () => meals.reduce((a, m) => a + totals(m.items).kcal, 0);
  for (let iter = 0; iter < 40; iter++) {
    const diff = target - sum();
    if (Math.abs(diff) <= 30) break;
    const dir = diff > 0 ? 1 : -1;
    let best = null, bestErr = Math.abs(diff);
    flat.forEach(it => {
      const f = FOODS[it.f];
      const nq = it.q + dir * f.step;
      if (nq < Math.max(f.step, it.base * 0.5) - 1e-9 || nq > it.base * 2.3 + 1e-9) return;
      const err = Math.abs(diff - dir * f.step * f.k);
      if (err < bestErr - 1e-9) { best = it; bestErr = err; }
    });
    if (!best) break;
    best.q = snap(best.q + dir * FOODS[best.f].step, FOODS[best.f].step);
  }
}
function pick(list, i, mult, off) {
  const n = list.length;
  let m = mult;
  while (gcd(m, n) !== 1) m++;
  return list[(i * m + off) % n];
}

/* Optional protein powder: the user supplies the label values for one scoop. */
const POWDER_SLOTS = { snack: 'afternoon snack', breakfast: 'post-workout breakfast' };
function powderOf(p) {
  const w = p && p.powder;
  if (!w || !POWDER_SLOTS[w.slot]) return null;
  const kcal = Number(w.kcal), protein = Number(w.protein);
  if (!(kcal > 0 && kcal <= 400 && protein > 0 && protein <= 80)) return null;
  return { slot: w.slot, scoops: clamp(Math.round(Number(w.scoops)) || 1, 1, 3), kcal, protein };
}
function shakeDef(pw, excl) {
  const liquid = excl.has('dairy') ? null : ['milk', 1];
  if (pw.slot === 'breakfast') {
    const carb = excl.has('gluten') ? ['dates', 2] : ['oats', 0.5];
    return ['W2', liquid ? 'Protein shake with oats, milk and banana' : 'Protein shake with oats and banana (made with water)', [['whey', pw.scoops]].concat(liquid ? [liquid] : [], [carb, ['banana', 1]])];
  }
  return ['W1', liquid ? 'Protein shake: powder, milk and banana' : 'Protein shake: powder, water, banana and berries', [['whey', pw.scoops], ['banana', 1]].concat(liquid ? [liquid] : [['berries', 1]])];
}
function buildMenu(dow, kind, target, excl, floor, pw) {
  const unmet = [];
  const allowed = (slot, list) => {
    const ok = list.filter(m => ![...mealTags(m)].some(t => excl.has(t)));
    if (!ok.length) { unmet.push(slot); return list; }
    if (ok.length < 2 && slot !== 'pre') unmet.push(slot);
    return ok;
  };
  const kcalTarget = Math.max(floor || 1400, Math.round(target + (kind === 'swim' ? 150 : kind === 'rest' ? -250 : 0)));
  const slots = [];
  const preList = kind === 'swim' ? MEALS.pre.filter(m => m[0] === 'P3') : kind === 'rest' ? MEALS.pre.filter(m => m[0] === 'P2') : MEALS.pre.filter(m => m[0] !== 'P3');
  slots.push(['pre', pick(allowed('pre', preList), dow, 1, 0)]);
  slots.push(['breakfast', pick(allowed('breakfast', MEALS.breakfast), dow, 1, 0)]);
  slots.push(['lunch', pick(allowed('lunch', MEALS.lunch), dow, 2, 1)]);
  slots.push(['snack', pick(allowed('snack', MEALS.snack), dow, 1, 1)]);
  slots.push(['dinner', pick(allowed('dinner', MEALS.dinner), dow, 3, 2)]);
  if (kcalTarget >= 2500) slots.push(['evening', pick(allowed('evening', MEALS.evening), dow, 1, 2)]);
  if (pw) { const at = slots.findIndex(x => x[0] === pw.slot); if (at >= 0) slots[at] = [pw.slot, shakeDef(pw, excl)]; }
  const labels = {
    pre: kind === 'rest' ? 'Early morning' : kind === 'swim' ? 'Pre-swim' : 'Pre-workout',
    breakfast: kind === 'rest' ? 'Breakfast' : 'Post-workout breakfast', lunch: 'Lunch', snack: 'Afternoon snack', dinner: 'Dinner', evening: 'Before bed',
  };
  const meals = slots.map(s => ({ slot: s[0], label: labels[s[0]], time: SLOT_TIME[s[0]], title: s[1][1], id: s[1][0], items: buildItems(s[1]) }));
  const base0 = meals.reduce((a, m) => a + totals(m.items).kcal, 0);
  if (kcalTarget < base0 * 0.95) {
    const fct = kcalTarget / base0;
    meals.forEach(m => m.items.forEach(it => {
      const f = FOODS[it.f];
      if (f.unit === 'serv') return;
      it.q = Math.max(f.step, snap(it.q * fct, f.step)); it.base = it.q;
    }));
  }
  fitDay(meals, kcalTarget);
  let tk = 0, tp = 0;
  meals.forEach(m => {
    m.items.forEach(it => { it.text = fmtQty(it.f, it.q); });
    const t = totals(m.items); m.kcal = t.kcal; m.protein = t.protein; tk += t.kcal; tp += t.protein;
    m.items = m.items.map(it => ({ text: it.text }));
  });
  return { dow, kind, kcalTarget, kcal: tk, protein: tp, meals, unmet };
}

/* ---------- calories ---------- */
function bmr(p) { return 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'male' ? 5 : -161); }
function tdee(p, sessions) { return bmr(p) * Math.min(1.75, 1.3 + 0.045 * sessions); }
function targets(p, goalType, sessions, aiAdj) {
  const maint = tdee(p, sessions);
  let adj = 0;
  if (goalType === 'gain') adj = p.bodyFat && p.bodyFat > 18 ? 100 : p.bodyFat && p.bodyFat <= 12 ? 350 : 250;
  else if (goalType === 'loss') adj = -400;
  else if (goalType === 'recomp') adj = 0;
  adj += clamp(Number(aiAdj) || 0, -200, 200);
  const floor = p.sex === 'male' ? 1800 : 1500;
  const kcal = Math.max(floor, Math.round((maint + adj) / 50) * 50);
  const perKg = goalType === 'loss' ? 2.2 : goalType === 'maint' ? 1.6 : 2.0;
  return { maintenance: Math.round(maint / 10) * 10, kcal, protein: Math.round(p.weight * perKg) };
}

/* ---------- plan generation ---------- */
function cautionsFor(flags, limitsText, age) {
  const out = [];
  const L = { shoulder: 'Shoulder', knee: 'Knee', lower_back: 'Lower back', wrist_elbow: 'Wrist or elbow', neck: 'Neck', hip: 'Hip', ankle: 'Ankle' };
  Object.keys(flags).forEach(a => {
    if (flags[a] >= 2) {
      const sw = {
        shoulder: 'Arnold press swapped for a neutral-grip dumbbell press and extra face-pull volume added on push days.',
        knee: 'Leg extension swapped for glute bridges; keep leg-press depth pain-free.',
        lower_back: 'Hanging knee raise swapped for dead bug; brace before every set.',
        wrist_elbow: 'Curls and pushdowns swapped for cable rope versions; push-ups made incline.',
      }[a] || 'Keep every movement pain-free.';
      out.push(L[a] + ': ' + sw + ' Stop any movement that provokes it, and see a sports physio if it persists.');
    } else {
      out.push(L[a] + ': tightness noted. Do the warm-up band work and the post-workout stretches every session, and do not add volume until it settles. Catching or pain that persists means a sports physio, not a program change.');
    }
  });
  if (!Object.keys(flags).length && String(limitsText || '').trim()) {
    out.push('Noted: "' + String(limitsText).trim().slice(0, 140) + '". Train pain-free, stop any movement that provokes it, and get it assessed if it persists.');
  }
  if (age >= 60) out.push('Age 60 or over: get medical clearance before starting and keep the first two weeks light.');
  return out;
}

function swimBlock(goalType, hasShoulder) {
  if (goalType === 'loss' || goalType === 'maint') {
    return [
      'Warm-up: 4 lengths (25 m) easy',
      'Steady swim: 20 to 30 min continuous, easy to moderate pace',
      'Pick-ups: 4 x (1 length fast, 1 length easy)',
      'Cool-down: 2 to 4 lengths easy',
      'Stay within 45 minutes in the water',
    ];
  }
  return [
    'Warm-up: 4 to 8 lengths (25 m) at an easy pace',
    'Pyramid up: 2, 4, 6 lengths at a moderate pace',
    'Sprint sets: 8 and 10 lengths, alternating 1 sprint length and 1 easy length',
    'Pyramid down: 6, 4, 2 lengths, sprinting the first and last length of each set',
    'Cool-down: 2 to 4 lengths easy',
    'Stay within 45 minutes in the water',
  ];
}

function generatePlan(profile, ctx) {
  ctx = ctx || {};
  const p = Object.assign({}, profile);
  p.age = Number(p.age); p.weight = Number(p.weight); p.height = Number(p.height);
  p.bodyFat = p.bodyFat ? Number(p.bodyFat) : null;
  const text = [p.limits, p.notes, ctx.answersText].filter(Boolean).join('. ');
  const notes = [];
  let goalKey = GOALS[p.goal] ? p.goal : 'chest_arms';
  const bmi = p.weight / Math.pow(p.height / 100, 2);
  if (GOALS[goalKey].type === 'loss' && bmi < 18.5) {
    goalKey = 'fitness';
    notes.push('Fat loss is not appropriate at your BMI, so the plan is set to maintenance. Speak to a clinician if unsure.');
  }
  const goal = GOALS[goalKey];
  let nStr = clamp(Number(p.strengthDays) || 4, 3, 5);
  if (p.experience === 'lt6' && nStr > 4) { nStr = 4; notes.push('Capped at 4 strength days while you build your base.'); }
  let nSwim = clamp(Number(p.swimDays) || 0, 0, 2);
  if (nStr + nSwim > 6) { nSwim = 6 - nStr; notes.push('Swim sessions reduced so you keep one full rest day.'); }
  const flags = detectFlags(text);
  (ctx.aiAreas || []).forEach(a => { if (FLAG_WORDS[a] && !flags[a]) flags[a] = 1; });
  const dietKeys = Array.from(new Set(detectDiet(text).concat(ctx.aiDiet || [])));
  const excl = new Set();
  dietKeys.forEach(k => (DIET_EXCL[k] || []).forEach(t => excl.add(t)));

  const prevLoads = ctx.prevLoads || {};
  const loadFor = k => prevLoads[k] || DEFAULT_LOADS[k] || LOAD_HINT;
  const split = SPLITS[goal.split][nStr];
  const pattern = PATTERNS[nStr + '-' + nSwim];
  const letters = ['A', 'B', 'C', 'D', 'E'];

  const swapMap = (k, dayKeys) => {
    let nk = k;
    if (flags.shoulder >= 2 && k === 'arnold') nk = 'ndbpress';
    if (flags.knee >= 2 && k === 'legext') nk = 'bridge';
    if (flags.lower_back >= 2 && k === 'hkr') nk = 'deadbug';
    if (flags.wrist_elbow >= 2 && k === 'ezcurl') nk = 'cablecurl';
    if (flags.wrist_elbow >= 2 && k === 'pushdown') nk = 'ropepd';
    if ((flags.wrist_elbow >= 2 || flags.shoulder >= 2) && k === 'ss_chest') nk = 'ss_chest_alt';
    if (flags.wrist_elbow >= 2 && k === 'ss_arms') nk = 'ss_arms_alt';
    if (nk !== k && dayKeys.indexOf(nk) >= 0) return null;
    return nk;
  };

  const workouts = {};
  const order = [];
  split.forEach((bpKey, idx) => {
    const bp = BP[bpKey];
    const wk = letters[idx];
    const raw = bp.ex.map(e => (typeof e === 'string' ? { k: e } : e));
    const keys = raw.map(r => r.k);
    const list = [];
    raw.forEach((r, i) => {
      const k = swapMap(r.k, keys);
      if (!k) return;
      const base = EX[k];
      let sets = r.sets || base.sets;
      if (p.experience === 'adv' && !r.sets && i < 2 && sets < 5) sets += 1;
      list.push({ id: wk + (list.length + 1) + '_' + k, key: k, name: base.name, sets, reps: base.reps, rest: base.rest, weight: loadFor(k), note: base.note || '' });
    });
    if (flags.shoulder >= 2 && (bp.warm === 'push' || bp.warm === 'chestarms') && !list.some(e => e.key === 'facepull')) {
      const b = EX.facepull;
      list.push({ id: wk + (list.length + 1) + '_facepull', key: 'facepull', name: b.name, sets: 2, reps: b.reps, rest: b.rest, weight: loadFor('facepull'), note: '' });
    }
    const wu = WARM[bp.warm] || WARM.full, st = STRETCH[bp.warm] || STRETCH.full;
    workouts[wk] = {
      key: wk, kind: 'workout', title: bp.title, focus: bp.warm,
      warmup: wu.map((t, i) => ({ id: wk + 'w' + i, text: t })),
      exercises: list,
      stretches: st.map((t, i) => ({ id: wk + 's' + i, text: t })),
    };
    order.push(wk);
  });
  if (nSwim > 0) {
    workouts.W = {
      key: 'W', kind: 'swim', title: 'Swim: ' + (goal.type === 'loss' || goal.type === 'maint' ? 'steady with pick-ups' : 'sprint pyramid'), focus: 'swim',
      warmup: WARM.swim.map((t, i) => ({ id: 'Ww' + i, text: t })),
      blocks: swimBlock(goal.type, flags.shoulder).map((t, i) => ({ id: 'Wb' + i, text: t })),
      stretches: STRETCH.swim.map((t, i) => ({ id: 'Ws' + i, text: t })),
    };
  }
  const schedule = pattern.map((tok, dow) => {
    if (tok === 'R') return { dow, kind: 'rest', ref: null, title: 'Rest day', focus: 'Full recovery' };
    if (tok === 'W') return { dow, kind: 'swim', ref: 'W', title: workouts.W.title, focus: 'Swim' };
    const wk = order[Number(tok.slice(1)) - 1];
    return { dow, kind: 'workout', ref: wk, title: 'Workout ' + wk, focus: workouts[wk].title };
  });
  const restDays = schedule.filter(s => s.kind === 'rest').length;

  const sessions = nStr + nSwim;
  const tg = targets(p, goal.type, sessions, ctx.aiCalAdj);
  const floorK = p.sex === 'male' ? 1800 : 1500;
  const pw = powderOf(p);
  if (pw) FOODS.whey = { n: 'protein powder', unit: 'scoop', k: pw.kcal, p: pw.protein, step: 1 };
  const menus = schedule.map(s => buildMenu(s.dow, s.kind, tg.kcal, excl, floorK, pw));
  const unmetSlots = Array.from(new Set([].concat.apply([], menus.map(m => m.unmet))));
  const avgK = Math.round(menus.reduce((a, m) => a + m.kcal, 0) / 7 / 50) * 50;
  const avgP = Math.round(menus.reduce((a, m) => a + m.protein, 0) / 7);

  const cautions = cautionsFor(flags, p.limits, p.age).concat(notes);
  if (dietKeys.length) cautions.push('Menu filtered for: ' + dietKeys.map(k => DIET_LABEL[k]).join(', ') + '.' + (unmetSlots.length ? ' Options are limited for ' + unmetSlots.join(', ') + '; tell me which foods work for you next time you reconsult.' : ''));

  const gi = [];
  gi.push('Stop each set 1 to 2 reps short of failure. Raise the load once you hit the top of the rep range on every set.');
  gi.push('Eat about ' + avgK.toLocaleString('en-US') + ' kcal and ' + avgP + ' g protein on average. The menu changes with the day: more on swim days, less on rest days.');
  if (pw) {
    const fb = totals(shakeDef({ slot: 'snack', scoops: 1 }, excl)[2].map(it => ({ f: it[0], q: it[1] })));
    gi.push('Protein powder: ' + pw.scoops + (pw.scoops === 1 ? ' scoop' : ' scoops') + ' (' + Math.round(pw.kcal * pw.scoops) + ' kcal, ' + Math.round(pw.protein * pw.scoops) + ' g protein) is built into the ' + POWDER_SLOTS[pw.slot] + ' every day, rest days included. If you cannot face a meal, a shake with one scoop is your fallback (about ' + fb.kcal + ' kcal and ' + fb.protein + ' g protein). Keep it to one swap a day so most of your food stays real food.');
  }
  if (goal.type === 'gain') gi.push('Track waist weekly. If it climbs faster than your lifts, trim about 200 kcal a day.');
  else if (goal.type === 'loss') gi.push('Aim to lose 0.25 to 0.5 kg a week. Keep protein and lifting loads up.');
  else gi.push('Track waist and weight weekly and adjust portions if both drift the wrong way.');
  gi.push('Warm up before and stretch after every session. Stop any movement that causes pain or catching.');
  gi.push('Sleep 7 to 9 hours. Rest days are part of the program.');
  if (goal.split === 'chest_arms') gi.splice(1, 0, 'Chest and arms are trained twice a week; back and rear-shoulder work keeps the joints balanced.');

  const tracking = [
    { id: 'waist', label: 'Waist measured (at the navel, morning)', unit: 'cm' },
    { id: 'weight', label: 'Body weight (average of 2 weigh-ins)', unit: 'kg' },
  ];
  if (goal.type === 'gain') {
    tracking.push({ id: 'chest', label: 'Chest measured', unit: 'cm' });
    tracking.push({ id: 'arm', label: 'Flexed upper arm measured', unit: 'cm' });
  }
  tracking.push({ id: 'photo', label: 'Progress photos taken (stay on your device)' });
  tracking.push({ id: 'joints', label: 'Joint check (shoulders, elbows, knees)', select: ['Fine', 'Tight', 'Painful'] });

  const goalLine = goal.type === 'gain'
    ? (goal.split === 'chest_arms' ? 'Bigger chest and arms while keeping your abs visible.' : goal.split === 'upper' ? 'Add size across the whole upper body.' : 'Add muscle everywhere with a balanced week.')
    : goal.type === 'loss' ? 'Drop body fat while holding on to muscle.' : goal.type === 'recomp' ? 'Lose fat and gain muscle at the same time.' : 'Get stronger, fitter and more consistent.';

  return {
    v: 1, createdAt: new Date().toISOString(),
    goal: { key: goalKey, label: goal.label, line: goalLine },
    stats: { strengthDays: nStr, swimDays: nSwim, restDays, kcal: avgK, protein: avgP, targetKcal: tg.kcal, targetProtein: tg.protein, maintenance: tg.maintenance },
    guidelines: gi, schedule, workouts, menus, tracking, cautions,
    coachNote: ctx.coachNote || '',
    flags, diet: dietKeys,
  };
}

/* ---------- default profile ---------- */
const DEFAULT_PROFILE = Object.assign({
  age: 30, sex: 'male', weight: 75, height: 175, experience: 'mid', strengthDays: 4, swimDays: 0,
  goal: 'full', bodyFat: null, limits: '', notes: '', powder: { slot: 'none', scoops: 1, kcal: '', protein: '' },
}, PERSONAL.profile || {});

/* ---------- questions ---------- */
function ruleQuestions(p, ctx) {
  ctx = ctx || {};
  const text = [p.limits, p.notes].filter(Boolean).join('. ');
  const flags = detectFlags(text);
  const qs = [];
  const lim = String(p.limits || '').trim();
  const limLow = ' ' + lim.toLowerCase() + ' ';
  const hasDetail = DETAIL_WORDS.some(w => limLow.includes(w));
  const areas = Object.keys(flags);
  if (lim && areas.length && !hasDetail) {
    qs.push({ id: 'q_limit_detail', q: 'About your ' + AREA_LABEL[areas[0]] + ': how long has it been an issue, does it hurt during or after training, and has a doctor or physio looked at it?' });
  } else if (lim && !areas.length && lim.length > 3) {
    qs.push({ id: 'q_limit_area', q: 'Which body area does "' + lim.slice(0, 60) + '" affect, and which movements bother it?' });
  }
  const dk = detectDiet(text);
  if (dk.length) {
    const excl = new Set();
    dk.forEach(k => (DIET_EXCL[k] || []).forEach(t => excl.add(t)));
    const tight = Object.keys(MEALS).some(slot => slot !== 'pre' && MEALS[slot].filter(m => ![...mealTags(m)].some(t => excl.has(t))).length < 2);
    if (tight) qs.push({ id: 'q_diet', q: 'Your food limits leave few menu options (' + dk.map(k => DIET_LABEL[k]).join(', ') + '). Which proteins and carbs do you eat regularly?' });
  }
  return qs;
}

/* ---------- day progress ---------- */
function entryFor(plan, d) { return plan.schedule[d.getDay()]; }
function itemsForEntry(plan, entry) {
  if (!entry || entry.kind === 'rest') return { warm: [], ex: [], blocks: [], stretch: [] };
  const w = plan.workouts[entry.ref];
  if (!w) return { warm: [], ex: [], blocks: [], stretch: [] };
  return { warm: w.warmup || [], ex: w.exercises || [], blocks: w.blocks || [], stretch: w.stretches || [] };
}
function dayProgress(plan, entry, doc) {
  const it = itemsForEntry(plan, entry);
  doc = doc || {};
  const checks = doc.checks || {}, sets = doc.sets || {};
  let total = 0, done = 0;
  it.warm.forEach(x => { total++; if (checks[x.id]) done++; });
  it.ex.forEach(x => { total += x.sets; done += Math.min(x.sets, sets[x.id] || 0); });
  it.blocks.forEach(x => { total++; if (checks[x.id]) done++; });
  it.stretch.forEach(x => { total++; if (checks[x.id]) done++; });
  return { total, done, complete: total > 0 && done >= total, pct: total ? Math.round(done / total * 100) : 0 };
}
function trackingDay(startStr, dateStr) {
  const n = diffDays(parseYmd(startStr), parseYmd(dateStr));
  return n >= 0 && n % 7 === 0;
}
function touchDay(startStr, dateStr) {
  const n = diffDays(parseYmd(startStr), parseYmd(dateStr));
  return n > 0 && n % 14 === 0;
}
function touchPeriod(startStr, dateStr) {
  const s = parseYmd(startStr), d = parseYmd(dateStr);
  const n = diffDays(s, d);
  const from = n - 14 > 0 ? addDays(s, n - 14) : s;
  return { from: ymd(from), to: dateStr };
}

/* ---------- touch-base recommendations ---------- */
function buildRecs(c) {
  const out = [];
  const rate = c.planned ? c.done / c.planned : 0;
  if (c.planned && rate < 0.6) out.push('Completion was ' + Math.round(rate * 100) + '%. Before adding anything, protect consistency: do the first four exercises of each session and stretch. Then build back up.');
  if (c.joints === 'Painful') out.push('Pain reported. Stop the movements that provoke it, keep loads light, and see a sports physio before progressing. Use Reconsult so the plan can swap exercises.');
  else if (c.joints === 'Tight') out.push('Tightness reported. Keep the band warm-up and sleeper stretch every session and hold volume steady for two weeks.');
  if (c.difficulty === 'hard' || c.recovery === 'tired') out.push('The load is high for you right now. Drop one set from accessory exercises for a week and stop sets with 2 reps in reserve.');
  else if (c.difficulty === 'easy' && rate >= 0.8 && c.joints !== 'Painful') out.push('You can progress: raise loads about 5% where you hit the top rep on every set, or add one set to the first two exercises of each session.');
  else if (c.difficulty === 'right' && rate >= 0.8) out.push('The load is well matched. Keep adding small weight or a rep each week.');
  if (c.waistDelta != null && c.weightDelta != null) {
    if (c.goalType === 'gain') {
      if (c.waistDelta >= 1.5 && c.weightDelta > 0.5) out.push('Waist is up ' + c.waistDelta.toFixed(1) + ' cm with weight up ' + c.weightDelta.toFixed(1) + ' kg. Fat gain is outpacing muscle: trim about 200 kcal a day.');
      else if (c.waistDelta <= 0.5 && Math.abs(c.weightDelta) < 0.3) out.push('Weight and waist are flat. To keep building, add about 150 kcal a day.');
      else if (c.waistDelta < 1.5 && c.weightDelta > 0) out.push('Weight is up ' + c.weightDelta.toFixed(1) + ' kg with waist change of ' + c.waistDelta.toFixed(1) + ' cm. The surplus is working; hold it.');
    } else if (c.goalType === 'loss') {
      if (c.weightDelta > -0.2) out.push('Weight has not dropped. Take about 150 kcal off most days and recheck in two weeks.');
      else if (c.weightDelta < -1.5) out.push('Weight is dropping faster than 0.75 kg a week. Add 150 kcal a day to protect muscle.');
      else out.push('Weight is moving at a good pace. Hold the current plan.');
    }
  }
  if (c.nutrition === 'rarely') out.push('Menu adherence is the lever. Prepare lunch and dinner the evening before.');
  (c.areas || []).forEach(a => out.push('You mentioned your ' + AREA_LABEL[a] + '. Use Reconsult with that in the limits box so exercises can be adapted.'));
  if (!out.length) out.push('Nothing needs to change. Keep going and recheck at the next touch base.');
  return out;
}

const api = {
  ymd, parseYmd, addDays, diffDays, startOfWeek, DOW, DOW3, MONTHS, clone, clamp,
  GOALS, EXPERIENCE, EX, DEFAULT_PROFILE, DEFAULT_LOADS, FLAG_WORDS, AREA_LABEL,
  detectFlags, detectDiet, DIET_LABEL, generatePlan, ruleQuestions, entryFor, itemsForEntry, dayProgress,
  trackingDay, touchDay, touchPeriod, buildRecs, bmr, tdee, targets, MEALS, FOODS, fmtQty, buildMenu, frac,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.WO = api;
})(typeof window !== 'undefined' ? window : globalThis);
