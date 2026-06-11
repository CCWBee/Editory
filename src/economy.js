// Parish economy — pure rules, no rendering. Everything that decides money,
// people and progression lives here so it can be simulated and balanced
// headlessly (see tools/simulate.mjs) and driven identically by game.js.
//
// The state object `s` is plain data:
//   { day, treasury, residents, happiness, happyBoost, weather, flags,
//     buildings: [{ type, row, col, age, seed }], milestones: [ids] }

// ---------- calendar ----------

export const SEASON_DAYS = 9;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const YEAR_DAYS = SEASON_DAYS * SEASONS.length;

export function seasonOf(day){ return SEASONS[Math.floor(((day - 1) % YEAR_DAYS) / SEASON_DAYS)]; }
export function dayOfSeason(day){ return ((day - 1) % SEASON_DAYS) + 1; }
export function yearOf(day){ return Math.floor((day - 1) / YEAR_DAYS) + 1; }

// ---------- building roster ----------
// homes: residents housed.  jobs: workers employed.  income: £/day at full
// staffing, before modifiers.  upkeep: £/day, grows with weathering.
// amenity: residents served (pubs, church, civic keep happiness up).
// character: the flame score.  weatherMul: how fast salt air bites.

export const TYPES = {
  terrace: { label: 'Terrace',         cost: 240,  homes: 4, jobs: 0,  income: 0,  upkeep: 1, character: 6,  amenity: 0,
             desc: 'Narrow attached homes — party walls, shared eaves' },
  house:   { label: 'House',           cost: 380,  homes: 5, jobs: 0,  income: 0,  upkeep: 1, character: 8,  amenity: 0,
             desc: 'Detached, gabled, twin chimneys' },
  bow:     { label: 'Bow-front',       cost: 620,  homes: 6, jobs: 0,  income: 0,  upkeep: 2, character: 12, amenity: 0,
             desc: 'Painted Georgian seafront — the St Aubin register' },
  future:  { label: 'Future house',    cost: 980,  homes: 7, jobs: 0,  income: 0,  upkeep: 2, character: 14, amenity: 0,
             weatherMul: 0.45, desc: 'Granite base, light upper — modern materials shrug off the salt' },
  store:   { label: 'Storehouse',      cost: 450,  homes: 0, jobs: 4,  income: 16, upkeep: 2, character: 5,  amenity: 0,
             stormHit: true, seafrontMul: 1.25, desc: 'Harbour trade — storms halve it, the seafront pays a quarter more' },
  pub:     { label: 'Parish pub',      cost: 520,  homes: 0, jobs: 3,  income: 10, upkeep: 2, character: 9,  amenity: 12,
             touristMagnet: true, seafrontMul: 1.25, desc: 'Keeps spirits up; summer trippers and autumn cider both pay' },
  field:   { label: 'Royal côtil',     cost: 300,  homes: 0, jobs: 2,  income: 2,  upkeep: 1, character: 7,  amenity: 0,
             harvest: 150, desc: 'Jersey Royals — a big payout when the spring crop lifts, if staffed' },
  civic:   { label: 'Civic hall',      cost: 900,  homes: 0, jobs: 2,  income: 0,  upkeep: 3, character: 16, amenity: 25,
             auraIncome: true, desc: '+8% to all building income (up to three halls)' },
  church:  { label: 'Parish church',   cost: 700,  homes: 0, jobs: 0,  income: 0,  upkeep: 2, character: 18, amenity: 20,
             weatherMul: 0.6, desc: 'Granite and a square tower — no parish without one' },
  'granite-glass': { label: 'Granite + glass', cost: 1600, homes: 0, jobs: 10, income: 40, upkeep: 5, character: 8, amenity: 0,
             weatherMul: 0.5, desc: 'The finance register — ten jobs and strong rent' },
};

export const TYPE_ORDER = ['terrace', 'house', 'bow', 'future', 'store', 'pub', 'field', 'civic', 'church', 'granite-glass'];

export const AURA_PER_CIVIC = 0.08, AURA_CAP = 3;
export const RENOVATE_FRACTION = 0.25;
export const DEMOLISH_REFUND = 0.5;
export const TAX_EMPLOYED = 2, TAX_UNEMPLOYED = 0.5;
export const OVERDRAFT_RATE = 0.05;

export function renovateCost(type){ return Math.ceil(TYPES[type].cost * RENOVATE_FRACTION); }

// ---------- unlocks ----------

export const UNLOCKS = {
  terrace: { test: () => true, req: '' },
  house:   { test: () => true, req: '' },
  store:   { test: () => true, req: '' },
  field:   { test: () => true, req: '' },
  pub:     { test: (s) => s.residents >= 12, req: '12 residents' },
  civic:   { test: (s) => s.residents >= 20, req: '20 residents' },
  church:  { test: (s) => s.milestones.includes('vingtaine'), req: 'Vingtaine' },
  bow:     { test: (s) => s.residents >= 30, req: '30 residents' },
  future:  { test: (s, st) => st.character >= 80, req: '80 character' },
  'granite-glass': { test: (s) => s.milestones.includes('parish'), req: 'Parish status' },
};

export function unlocked(type, s, st = derive(s)){ return UNLOCKS[type].test(s, st); }

// ---------- milestones ----------

export const MILESTONES = [
  { id: 'vingtaine', label: 'Vingtaine', reward: 150,
    desc: '25 residents',
    test: (s) => s.residents >= 25 },
  { id: 'parish', label: 'Parish status', reward: 400,
    desc: '60 residents · a church · 130 character',
    test: (s, st) => s.residents >= 60 && st.kinds.has('church') && st.character >= 130 },
  { id: 'royal', label: 'Royal charter', reward: 1000,
    desc: '85 residents · 200 character · 70 happiness · £2,000 banked',
    test: (s, st) => s.residents >= 85 && st.character >= 200 && s.happiness >= 70 && s.treasury >= 2000 },
];

export function nextMilestone(s){
  return MILESTONES.find(m => !s.milestones.includes(m.id)) || null;
}

// ---------- derived stats ----------

export function derive(s){
  let homes = 0, jobs = 0, charRaw = 0, amenityCap = 0, amenitySpots = 0, ageSum = 0, civics = 0;
  const kinds = new Set();
  for (const b of s.buildings){
    const t = TYPES[b.type];
    homes += t.homes; jobs += t.jobs; charRaw += t.character;
    if (t.amenity){ amenityCap += t.amenity; amenitySpots++; }
    if (t.auraIncome) civics++;
    ageSum += b.age;
    kinds.add(b.type);
  }
  const n = s.buildings.length;
  const employed = Math.min(s.residents, jobs);
  return {
    n, homes, jobs, kinds, civics, amenityCap, amenitySpots,
    character: charRaw + kinds.size * 5,
    charPerBuilding: n ? charRaw / n : 0,
    employed,
    staffing: jobs ? employed / jobs : 0,
    employmentRate: s.residents ? employed / s.residents : 1,
    // A village green allowance — a hamlet of a dozen needs no pub yet
    coverage: s.residents ? Math.min(1, (amenityCap + 8) / s.residents) : 1,
    avgAge: n ? ageSum / n : 0,
  };
}

// ---------- happiness & migration ----------

export function computeHappiness(s, st = derive(s)){
  let h = 53;
  h += st.employmentRate * 15 - (1 - st.employmentRate) * 8;
  h += st.coverage * 15 - (1 - st.coverage) * 8;
  h += Math.min(12, st.charPerBuilding * 1.2);
  h -= Math.max(0, st.avgAge - 0.40) * 60;
  if (s.weather === 'storm') h -= 4;
  h += s.happyBoost;
  return Math.round(Math.max(5, Math.min(100, h)));
}

function migrate(s, st){
  const free = st.homes - s.residents;
  if (s.happiness >= 52 && free > 0){
    const n = Math.min(free, 1 + Math.floor((s.happiness - 38) / 15));
    s.residents += n;
    return n;
  }
  if (s.happiness < 36 && s.residents > 0){
    const n = Math.min(s.residents, 1 + Math.floor((36 - s.happiness) / 12));
    s.residents -= n;
    return -n;
  }
  return 0;
}

// ---------- the daily ledger ----------

export function ledger(s, st = derive(s)){
  const season = seasonOf(s.day);
  const aura = 1 + AURA_PER_CIVIC * Math.min(AURA_CAP, st.civics);

  let income = 0, upkeep = 0;
  for (const b of s.buildings){
    const t = TYPES[b.type];
    upkeep += t.upkeep * (1 + b.age * 1.8);
    if (t.income){
      let v = t.income * (0.25 + 0.75 * st.staffing) * (1 - b.age * 0.55);
      if (b.row === 0 && t.seafrontMul) v *= t.seafrontMul;
      if (s.weather === 'storm' && t.stormHit) v *= 0.5;
      if (t.touristMagnet){
        if (season === 'Summer') v *= 1.6;
        else if (season === 'Autumn') v *= 1.25;   // cider season
      }
      income += v;
    }
  }
  income *= aura;

  const taxMul = 0.5 + s.happiness / 100;
  const tax = (st.employed * TAX_EMPLOYED + Math.max(0, s.residents - st.employed) * TAX_UNEMPLOYED) * taxMul;

  let tourism = 0;
  if (season === 'Summer'){
    tourism = Math.min(40, st.character / 4) * (st.amenitySpots > 0 ? 1 : 0.3);
    if (s.weather === 'storm') tourism *= 0.25;
    if (s.flags && s.flags.battle) tourism *= 2;
  }

  let harvest = 0;
  if (season === 'Spring' && dayOfSeason(s.day) === SEASON_DAYS){
    const fields = s.buildings.filter(b => b.type === 'field').length;
    harvest = Math.round(fields * TYPES.field.harvest * (0.4 + 0.6 * st.staffing));
  }

  const net = Math.round(income + tax + tourism + harvest - upkeep);
  return {
    income: Math.round(income), tax: Math.round(tax), tourism: Math.round(tourism),
    harvest, upkeep: Math.round(upkeep), net,
  };
}

// ---------- weathering ----------

export function applyWeathering(s){
  for (const b of s.buildings){
    const t = TYPES[b.type];
    let rate = 0.006 * (t.weatherMul ?? 1) * (b.row === 0 ? 1.6 : 1);
    if (s.weather === 'storm') rate += b.row === 0 ? 0.008 : 0.003;
    b.age = Math.min(0.95, +(b.age + rate).toFixed(4));
  }
}

// ---------- weather ----------

const WEATHER_TABLE = {
  Spring: [0.60, 0.30, 0.10],
  Summer: [0.80, 0.15, 0.05],
  Autumn: [0.50, 0.30, 0.20],
  Winter: [0.40, 0.30, 0.30],
};

export function rollWeather(season, rnd = Math.random){
  const [fair, drizzle] = WEATHER_TABLE[season];
  const r = rnd();
  return r < fair ? 'fair' : r < fair + drizzle ? 'drizzle' : 'storm';
}

// ---------- events ----------

const FLAVOUR = [
  { season: null,     cash: 30, msg: 'Low-water fishing on the ebb — £30' },
  { season: 'Winter', cash: 35, msg: 'Ormer season opens at the spring tide — £35' },
  { season: 'Summer', cash: 40, msg: 'Day-trippers off the St Malo ferry — £40' },
  { season: 'Autumn', cash: 25, msg: 'Cider pressing in the parish — £25' },
  { season: 'Autumn', cash: 20, msg: 'Vraicing on the low tide — the côtils are fed — £20', needs: 'field' },
  { season: 'Spring', cash: 30, msg: 'Early Royals fetch a premium at the hedge stall — £30', needs: 'field' },
  { season: null,     cash: 45, msg: 'A film crew rents the seafront for a costume drama — £45' },
];

function calendarEvents(s, st, rnd, msgs){
  const season = seasonOf(s.day), dos = dayOfSeason(s.day);

  if (season === 'Spring' && dos === 1) msgs.push('Planting season on the côtils');
  if (season === 'Summer' && dos === 1){
    s.treasury += 100; s.happyBoost += 10;
    msgs.push('Liberation Day — bunting on every gable (+£100)');
  }
  if (season === 'Summer' && dos === 6 && s.happiness >= 60){
    s.flags.battle = true; s.happyBoost += 5;
    msgs.push('Battle of Flowers — floats sweep the seafront, tourism doubles today');
  }
  if (season === 'Autumn' && dos === 1 && s.buildings.length >= 4){
    msgs.push('The Visite Royale approaches — smarten the parish up');
  }
  if (season === 'Autumn' && dos === 3 && s.buildings.length >= 4){
    if (st.avgAge < 0.35){ s.treasury += 150; msgs.push('Visite Royale — the parish is praised for its upkeep (+£150)'); }
    else if (st.avgAge > 0.50){ s.treasury -= 100; msgs.push('Visite Royale — fined for neglect (−£100)'); }
    else msgs.push('Visite Royale — the parish passes muster');
  }
  if (season === 'Winter' && dos === 1) msgs.push('Winter sets in — the Atlantic turns surly');

  if (rnd() < 0.12){
    const pool = FLAVOUR.filter(f =>
      (!f.season || f.season === season) &&
      (!f.needs || s.buildings.some(b => b.type === f.needs)));
    if (pool.length){
      const f = pool[Math.floor(rnd() * pool.length)];
      s.treasury += f.cash;
      msgs.push(f.msg);
    }
  }
}

function checkMilestones(s, msgs){
  const st = derive(s);
  for (const m of MILESTONES){
    if (!s.milestones.includes(m.id) && m.test(s, st)){
      s.milestones.push(m.id);
      s.treasury += m.reward;
      s.happyBoost += 8;
      msgs.push(`★ ${m.label} achieved — grant of £${m.reward}`);
      if (m.id === 'royal') msgs.push('★ The parish holds a Royal Charter. The flame is carried.');
    }
  }
}

// ---------- the day tick ----------

export function newParish(){
  return {
    day: 1, treasury: 1500, residents: 0, happiness: 75, happyBoost: 0,
    weather: 'fair', flags: {}, buildings: [], milestones: [],
  };
}

export function advanceDay(s, rnd = Math.random){
  const msgs = [];
  const st = derive(s);

  // 1) Settle the ledger for the day that just ended
  const led = ledger(s, st);
  s.treasury += led.net;
  if (led.harvest) msgs.push(`Jersey Royals lifted from the côtils — £${led.harvest}`);
  msgs.push(`Day ${s.day} ${led.net >= 0 ? 'banked' : 'cost'} £${Math.abs(led.net)}`);
  s.flags.battle = false;

  // 2) Salt air does its work
  applyWeathering(s);

  // 3) People vote with their feet
  const moved = migrate(s, st);
  if (moved > 0) msgs.push(`${moved} new resident${moved > 1 ? 's' : ''} settle in the parish`);
  if (moved < 0) msgs.push(`${-moved} resident${moved < -1 ? 's' : ''} leave for St Helier`);

  // 4) Mood
  s.happyBoost = Math.round(s.happyBoost * 0.7 * 10) / 10;
  s.happiness = computeHappiness(s);

  // 5) New day, new weather
  s.day += 1;
  s.weather = rollWeather(seasonOf(s.day), rnd);
  if (s.weather === 'storm') msgs.push('Storm over the harbour — trade suffers, the seafront weathers');

  // 6) The calendar turns
  calendarEvents(s, derive(s), rnd, msgs);

  // 7) The States don't lend for free
  if (s.treasury < 0){
    const interest = Math.ceil(-s.treasury * OVERDRAFT_RATE);
    s.treasury -= interest;
    msgs.push(`States overdraft — £${interest} interest`);
  }

  checkMilestones(s, msgs);
  return { msgs, ledger: led };
}
