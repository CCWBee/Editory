// Balance harness for Parish mode. Plays the economy headlessly with a few
// bot strategies and prints the curves, so number changes in economy.js can
// be sanity-checked before anyone clicks a plot.
//
//   node tools/simulate.mjs [days] [seed]

import {
  newParish, advanceDay, derive, ledger, TYPES, TYPE_ORDER,
  unlocked, renovateCost, seasonOf, yearOf, nextMilestone,
  DEMOLISH_REFUND,
} from '../src/economy.js';

const DAYS = +(process.argv[2] || 108);
const SEED = +(process.argv[3] || 7);
const ROWS = 3, COLS = 9, PLOTS = ROWS * COLS;

function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function freePlot(s, preferRow){
  const used = new Set(s.buildings.map(b => `${b.row},${b.col}`));
  const order = preferRow === 0 ? [0, 1, 2] : [1, 2, 0];
  for (const r of order){
    for (let c = 0; c < COLS; c++){
      if (!used.has(`${r},${c}`)) return { row: r, col: c };
    }
  }
  return null;
}

function build(s, type, preferRow){
  const plot = freePlot(s, preferRow);
  if (!plot) return false;
  const t = TYPES[type];
  if (s.treasury < t.cost + 80) return false;        // keep a float
  if (!unlocked(type, s)) return false;
  s.treasury -= t.cost;
  s.buildings.push({ type, row: plot.row, col: plot.col, age: 0.05, seed: 1 });
  return true;
}

// The "plays sensibly" bot: renovate when shabby, keep homes/jobs/amenities
// in ratio, push character for milestones.
function botBalanced(s){
  const st = derive(s);

  // Renovate the worst building once it drags
  const worst = [...s.buildings].sort((a, b) => b.age - a.age)[0];
  if (worst && worst.age > 0.50 && s.treasury > renovateCost(worst.type) + 120){
    s.treasury -= renovateCost(worst.type);
    worst.age = 0.05;
    return;
  }

  if (s.buildings.length >= PLOTS){
    // Endgame: the charter wants residents — upgrade tired low-density stock
    // into the future register (the flame carried forward, +3 homes a swap)
    if (!s.milestones.includes('royal') && st.homes < 88
        && unlocked('future', s, st) && s.treasury > TYPES.future.cost + 200){
      const idx = s.buildings.findIndex(b => b.type === 'terrace' || b.type === 'house');
      if (idx >= 0){
        const old = s.buildings[idx];
        s.treasury += Math.round(TYPES[old.type].cost * DEMOLISH_REFUND) - TYPES.future.cost;
        s.buildings.splice(idx, 1);
        s.buildings.push({ type: 'future', row: old.row, col: old.col, age: 0.05, seed: 1 });
      }
    }
    return;
  }

  const count = (k) => s.buildings.filter(b => b.type === k).length;

  // Save deliberately for the strategic buildings instead of spending the
  // float on cheap stock — the milestone chain runs through the church, and
  // endgame happiness runs through civic amenity.
  const savingFor =
    count('church') === 0 && unlocked('church', s, st) ? 'church'
    : st.coverage < 0.9 && s.residents >= 20 && count('civic') < 2 && unlocked('civic', s, st) ? 'civic'
    : null;
  if (savingFor){
    if (build(s, savingFor)) return;
    if (s.treasury < TYPES[savingFor].cost + 480) return;   // keep saving
  }

  // Employment rate is worth more happiness than raw job count is worth tax:
  // keep jobs at ~60% of residents and let homes lead.
  const wantAmenity = st.coverage < 0.9 && s.residents >= 12;
  const wantJobs = st.jobs < Math.min(Math.ceil(s.residents * 0.6), 46);
  const wantHomes = st.homes - s.residents < 5;

  if (wantAmenity){
    if (build(s, 'church')) return;
    if (count('civic') < 2 && build(s, 'civic')) return;
    if (count('pub') < 3 && build(s, 'pub', 0)) return;
  }
  if (wantJobs){
    if (build(s, 'granite-glass')) return;
    if (build(s, 'store', 0)) return;
    if (count('field') < 2 && build(s, 'field')) return;
  }
  if (wantHomes){
    if (build(s, 'future')) return;
    if (build(s, 'bow', 0)) return;
    if (build(s, 'house')) return;
    if (build(s, 'terrace')) return;
  }
  // Otherwise bank it
}

// The "set and forget" bot: builds five things then never touches it again.
function botLazy(s){
  if (s.buildings.length === 0){
    build(s, 'terrace'); build(s, 'store', 0); build(s, 'terrace'); build(s, 'house'); build(s, 'field');
  }
}

// The "slumlord" bot: housing only — should stall on jobs and happiness.
function botSlumlord(s){
  const st = derive(s);
  if (st.homes - s.residents < 6){
    if (build(s, 'house')) return;
    if (build(s, 'terrace')) return;
  }
}

function run(label, bot){
  const rnd = mulberry32(SEED);
  const s = newParish();
  let minTreasury = Infinity, milestoneDays = {};
  console.log(`\n=== ${label} ===`);
  console.log('day  seasn  £trea  res homes jobs  hap char  age  net/d  milestone');
  for (let d = 1; d <= DAYS; d++){
    bot(s);
    const before = new Set(s.milestones);
    advanceDay(s, rnd);
    for (const id of s.milestones) if (!before.has(id)) milestoneDays[id] = s.day;
    minTreasury = Math.min(minTreasury, s.treasury);
    if (s.day % 6 === 0 || d === DAYS){
      const st = derive(s);
      const led = ledger(s, st);
      console.log(
        String(s.day).padStart(3),
        seasonOf(s.day).slice(0, 5).padEnd(6),
        String(s.treasury).padStart(6),
        String(s.residents).padStart(4),
        String(st.homes).padStart(5),
        String(st.jobs).padStart(4),
        String(s.happiness).padStart(4),
        String(st.character).padStart(4),
        st.avgAge.toFixed(2).padStart(5),
        String(led.net).padStart(6),
        ' ' + (nextMilestone(s) ? 'next: ' + nextMilestone(s).label : 'ROYAL CHARTER'),
      );
    }
  }
  console.log(`built ${s.buildings.length}/${PLOTS} · min treasury £${minTreasury} · milestones: ${JSON.stringify(milestoneDays)}`);
}

run('balanced bot', botBalanced);
run('lazy bot (5 buildings, walk away)', botLazy);
run('slumlord bot (housing only)', botSlumlord);
