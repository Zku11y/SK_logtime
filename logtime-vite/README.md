# Logtime CRT — Vite + React + Three.js

Run on a computer connected to the school LAN, using Node.js 22.13+:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. Enter login and dates, then Display logtime.
Only the login/date form remains over the scene and stays open after submitting.
Only hours and minutes appear on the TV; dashes appear before a request succeeds.

All four supplied models are bundled locally. No Sketchfab connection or
remote assets are needed at runtime. Textures have been resized to a maximum
of 1536px for lower GPU memory use; originals remain in your uploaded archives.
Model attribution and CC BY 4.0 licenses are retained under public/models and
available at /credits.html.

Scene: fixed camera in the central bay, looking level down negative Z; CRT on
the diner table; supplied floor cables extend right toward the wall, joined by
additional curves to make the TV connection visible. A canvas texture shows
logtime on the CRT face, with green glow and scanlines. Rendering occurs only
on load, resize, and data changes, avoiding a continuous render loop.

Main scene positions and lighting: src/Scene.tsx.
Login/date controls: src/App.tsx. API request: src/api.js.

The exact JSON body is forwarded unchanged:
{"login":"mdakni","startDate":"2026-09-28","endDate":"2026-10-20"}

Browser -> local /api/get_log -> https://logtime-med.1337.ma/api/get_log
The Vite process must be inside the school LAN. CORS is handled by the proxy.
TLS verification is enabled. If needed, supply the school's trusted CA using
NODE_EXTRA_CA_CERTS. The application does not save logtime or login locally.

```bash
npm test
npm run build
npm run preview
```

Preview at http://127.0.0.1:4173 has the same proxy. Running npm run build creates dist/ with the app and models. Do not open index.html through file://. Static production
hosting requires an equivalent reverse proxy running on the school network.

Typecheck, production build, API parsing and statistics tests pass. Model
geometry and transformations were inspected. Browser rendering and the live
LAN endpoint could not be verified in this environment; check framing locally.

Model authors: Brutalist Interior by vslite; Sony PVM-14L2 CRT TV by Poring;
Rusty Old Diner Table by cansuaydin; Cables on floor by nooraha.
Full source URLs and license notices are in each model's license.txt.
Modifications: resized textures, placement/scaling, lighting/material tuning,
added screen and connecting cable geometry.

## Blank-scene fix (3.0.1)

The WebGL canvas is now a dedicated React-owned element, separate from loading
status. Loading completion no longer risks clearing the imperatively appended
canvas. The camera-to-TV line was also checked against the room geometry.

## Adjust lighting

At the top of src/Scene.tsx, edit LIGHTING while npm run dev is running.
Save to refresh the scene. Start with ambient, keyIntensity, and exposure.
- ambient: soft light across the room. Try 0.5 for deeper shadows or 2.4 for a brighter room.
- keyIntensity: main light brightness. Try 2 to 5.
- keyPosition: [x, y, z]; x moves left/right, y up/down, z forward/back.
- keyColor: warm #fff0d8, neutral #ffffff, cool #c5ddff.
- fillIntensity: secondary light brightness; 0 disables it.
- screenIntensity: green light spill near the CRT.
- exposure: overall brightness. Try 0.8 to 1.5 after balancing the lights.
- fogDensity: 0 removes fog; larger values add haze.
These are starting points, not enforced limits. Change one setting at a time.
The CRT readout uses an unlit material with tone mapping disabled, so exposure
and scene lights do not change the text itself.
ROOM_ROTATION_DEGREES is 90; set -90 if the opposite direction is needed.
