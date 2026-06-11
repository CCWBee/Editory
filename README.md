# Editory

> *Not the worship of the ashes — the veneration of the flame.*
> A generator — and now a small game — for Neo-Anglo-Norman architecture.

A generative sandbox for Jersey vernacular — pink granite, lime render, slate, salt-aged everything — treated as a living architectural language rather than a heritage costume. The flame is the language; this is an attempt to carry it forward.

Two modes, switched by the tabs at the top of the panel:

- **Sandbox** — the original generator. Pull the sliders, watch a harbour front recompose itself across time of day, weather, and material register. The Atlantic light does most of the work.
- **Parish** — a pocket city-builder. Three rows of plots climb inland from the harbour road; you get £1,500 and the everyday registers, and you grow a parish from there.

## Run

ES-module imports require a server, not `file://`:

```sh
python -m http.server 8080
# then open http://localhost:8080
```

Or any equivalent static server.

## Vocabulary

| Material | What it is |
|---|---|
| Pink granite | The cliffs of La Corbière, Mont Orgueil — the iconic Jersey stone |
| Lime render | Warm-white finish on civic and farmhouse buildings |
| Slate panels | Roofs, ridge caps, occasional cladding |
| Timber + stone | A quieter rural register |
| Fibreglass | The contemporary intervention — the bit that makes this *neo* |

| Preset | What it builds |
|---|---|
| District mix | Mixed terrace, house, storehouse and civic across the row |
| Terrace | Narrow attached units, party walls, shared eaves |
| Contemporary house | Detached, larger openings, lower pitch |
| Civic | Wider, symmetrical, with eaves cornice and quoins |
| Coastal storehouse | Long plain gabled mass with a wide loading door |

## Parish mode

A city-builder with three loops, all of them Jersey.

**The minute loop — keep three ratios in balance.** Homes draw residents (migration runs on happiness), workplaces only earn at full rate when staffed, and amenities — pub, church, civic hall — keep happiness up. Happiness drives both the tax take and whether people arrive or leave for St Helier.

**The day loop — the salt air takes its toll.** Every building weathers, visibly: income falls and upkeep rises until you renovate (a quarter of build cost). Seafront plots earn a trade bonus but weather faster, and storms batter them hardest — placement is a bet. Days roll past on their own (pause / 1× / 3× / 6×), weather rolls daily by season, and an overdrawn treasury accrues States interest.

**The year loop — a 36-day Jersey calendar.** Spring ends with the Jersey Royals lifted from your côtils (staff them or lose most of the crop). Summer brings tourists scaled by parish character, Liberation Day, and the Battle of Flowers. Autumn brings cider season and the Visite Royale — an inspection that pays a kept parish and fines a shabby one. Winter is storm season.

| Building | Cost | Homes | Jobs | £/day | Character | Unlock |
|---|---|---|---|---|---|---|
| Terrace | £240 | 4 | — | — | 6 | — |
| House | £380 | 5 | — | — | 8 | — |
| Bow-front | £620 | 6 | — | — | 12 | 30 residents |
| Future house | £980 | 7 | — | — | 14 | 80 character |
| Storehouse | £450 | — | 4 | 16 | 5 | — |
| Parish pub | £520 | — | 3 | 10 | 9 | 12 residents |
| Royal côtil | £300 | — | 2 | 2 + harvest | 7 | — |
| Civic hall | £900 | — | 2 | +8% aura | 16 | 20 residents |
| Parish church | £700 | — | — | — | 18 | Vingtaine |
| Granite + glass | £1,600 | — | 10 | 40 | 8 | Parish status |

**Character** is the flame thesis as a mechanic: each building contributes points and every *distinct* register adds a variety bonus — a parish of one building type is a costume, not a language. It gates the later registers and pulls in tourists.

**Milestones:** *Vingtaine* (25 residents) → *Parish status* (60 residents, a church, 130 character) → *Royal Charter* (85 residents, 200 character, 70 happiness, £2,000 banked) — the win, though the parish keeps living after it.

Pick a card, click a plot. Renovate and Demolish work the same way. <kbd>Esc</kbd> drops the tool. The parish autosaves to `localStorage`; "new parish" razes it.

### Balancing

All rules live in `src/economy.js`, pure and renderer-free. `node tools/simulate.mjs [days] [seed]` plays the economy headlessly with three bot strategies — a sensible player, a build-and-walk-away player, and a housing-only player — and prints the curves. The sensible bot reaches the Royal Charter around day 180–230; the other two fail in the ways they deserve to. Tune a number, re-run, see what bends.

## Keyboard

| Key | Action |
|---|---|
| <kbd>G</kbd> | Regenerate at current seed (sandbox) |
| <kbd>R</kbd> | Reseed and regenerate (sandbox) |
| <kbd>F</kbd> | Reset view |
| <kbd>H</kbd> | Hide the panel |
| <kbd>Esc</kbd> | Drop the current build tool (parish) |
| <kbd>?</kbd> | About |

Seed travels in the URL hash — copy the link to share what you made.

## How it works

- Three.js, no build step, no bundler. Module imports off unpkg.
- `scene.js` — renderer, camera, sky dome, sea, harbour wall, road.
- `generator.js` — buildings, streetlights, cars, rain. Mulberry32 PRNG seeded.
- `economy.js` — every Parish rule: roster, seasons, weather odds, ledger, happiness, migration, weathering, events, milestones. Pure data in, data out.
- `game.js` — Parish mode rendering and interaction: plot grid, raycast build/renovate/demolish tools, bespoke church/côtil/pub visuals, weathering rebuilds, localStorage save.
- `main.js` — atmosphere (sun arc, sky colour keyframes, fog, wet stone), sea waves, car motion, rain fall, window glow at dusk, mode switching.
- `ui.js` — panel wiring, seed-in-URL, screenshot, About modal.
- `tools/simulate.mjs` — headless balance harness.

Roofs are real gabled prisms with triangular gable walls. Granite buildings get stepped corner quoins; granite/render get sills and surrounds; civics get an eaves cornice and a string course. Sun position arcs from sunrise in the east through noon to sunset in the west; sky vertex colours interpolate across twelve keyframes through the day; fog tightens and sun dims when rain rises.

## Licence

MIT — do something with it.
