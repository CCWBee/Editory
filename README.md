# Editory

> A generator for Neo-Anglo-Norman architecture.

A generative sandbox for Jersey vernacular — pink granite, lime render, slate, salt-aged everything — treated as a living architectural language rather than a heritage costume.

Pull the sliders, watch a harbour front recompose itself across time of day, weather, and material register. The Atlantic light does most of the work.

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

## Keyboard

| Key | Action |
|---|---|
| <kbd>G</kbd> | Regenerate at current seed |
| <kbd>R</kbd> | Reseed and regenerate |
| <kbd>F</kbd> | Reset view |
| <kbd>H</kbd> | Hide the panel |
| <kbd>?</kbd> | About |

Seed travels in the URL hash — copy the link to share what you made.

## How it works

- Three.js, no build step, no bundler. Module imports off unpkg.
- `scene.js` — renderer, camera, sky dome, sea, harbour wall, road.
- `generator.js` — buildings, streetlights, cars, rain. Mulberry32 PRNG seeded.
- `main.js` — atmosphere (sun arc, sky colour keyframes, fog, wet stone), sea waves, car motion, rain fall, window glow at dusk.
- `ui.js` — panel wiring, seed-in-URL, screenshot, About modal.

Roofs are real gabled prisms with triangular gable walls. Granite buildings get stepped corner quoins; granite/render get sills and surrounds; civics get an eaves cornice and a string course. Sun position arcs from sunrise in the east through noon to sunset in the west; sky vertex colours interpolate across twelve keyframes through the day; fog tightens and sun dims when rain rises.

## Licence

MIT — do something with it.
