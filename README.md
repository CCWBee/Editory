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

A small city-builder layered on the generator. Days roll past on their own (pause / 1× / 3×), the weather drifts with them, and at each day's end every building pays into the treasury.

| Building | Cost | Residents | Income/day | Character | Unlock |
|---|---|---|---|---|---|
| Terrace | £240 | 4 | £7 | 6 | — |
| House | £380 | 5 | £10 | 8 | — |
| Storehouse | £450 | — | £18 (½ in storms) | 5 | — |
| Civic hall | £900 | — | £2, +8% parish income | 16 | 18 residents |
| Bow-front | £620 | 6 | £15 | 12 | 35 residents |
| Future house | £980 | 7 | £20 | 14 | 70 character |
| Granite + glass | £1,600 | — | £48 | 8 | 60 residents |

**Character** is the flame thesis as a mechanic: each building contributes points, and every *distinct* register in the parish adds a variety bonus — a parish of one building type is a costume, not a language. Demolition refunds half. Up to three civic halls stack their income bonus. The parish autosaves to `localStorage`; "new parish" razes it.

Pick a card, click a plot. Click a building with Demolish selected to raze it. <kbd>Esc</kbd> drops the current tool.

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
- `game.js` — Parish mode: plot grid, raycast build/demolish tools, economy, day/weather loop, unlocks, localStorage save.
- `main.js` — atmosphere (sun arc, sky colour keyframes, fog, wet stone), sea waves, car motion, rain fall, window glow at dusk, mode switching.
- `ui.js` — panel wiring, seed-in-URL, screenshot, About modal.

Roofs are real gabled prisms with triangular gable walls. Granite buildings get stepped corner quoins; granite/render get sills and surrounds; civics get an eaves cornice and a string course. Sun position arcs from sunrise in the east through noon to sunset in the west; sky vertex colours interpolate across twelve keyframes through the day; fog tightens and sun dims when rain rises.

## Licence

MIT — do something with it.
