# The Four Seasons Gallery

A walk-through 3D museum made in Game Studio (Godot game `g-vivldi`, app 12) for the Hackathon 2026
"Immersive gallery" challenge. A rotunda opens onto four wings, Spring, Summer, Autumn and Winter.
Each plays its concerto from Vivaldi's *Four Seasons*, hangs five public-domain paintings, looks out
on a 3D landscape, and is full of things to tap. A brass lever switches the whole museum between day
and night; at night each wing plays its slow middle movement.

Controls: WASD / arrows and the mouse on a computer; left thumb walks and right thumb looks on a
phone; tap or click things to play with them. N toggles day and night.

## How it is packaged
- `game/` holds the Godot web export: `godot.js`, the audio worklets, and the engine (gzip-compressed
  to fit the 64 MiB app package) and game pack, each split into 1 MB parts (`wasm/`, `pck/`,
  counted in `parts.json`) so every file stays small enough to publish.
- `index.jsx` downloads those files (joining the parts) with a progress bar and hands them to an inline game frame
  (`srcdoc`), which unpacks the engine with `DecompressionStream` and starts Godot. The game runs
  in srcdoc rather than the `/app-embeds` lane because that lane's policy does not allow
  WebAssembly. The cover hides only after the frame's `fsg:ready` message.

## Updating after changes in Game Studio
Edit the game in Game Studio, then run `bash export.sh` here and apply the app again. (The script expects the Game Studio project at the path written inside it.)

## Credits
- Music: Antonio Vivaldi, *The Four Seasons*, performed by John Harrison (violin) with the Wichita
  State University Chamber Players; Wikimedia Commons, CC BY-SA 4.0.
- Paintings: public domain via Wikimedia Commons (Botticelli, Arcimboldo, Van Gogh, Monet, Bruegel,
  Seurat, Levitan, Klimt, Avercamp).
- Skies and ground textures: Poly Haven (CC0). Thunder: "Rain + Long Thunder" by WuxiaScrub (CC0,
  OpenGameArt). Lever sound: Kenney Impact Sounds (CC0).
- Building, sculptures and landscapes: made in Blender inside Game Studio on Möbius.
