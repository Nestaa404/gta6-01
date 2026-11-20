// Solmara — a GTA-style open-world crime game for the make.fun
// gta6-01 bounty. This program is the entrypoint: it hands the game
// in by copying game/ and screenshots/ from this repository into the
// output directory and writing dossier.json with the kit's vendored
// make.fun library. It runs on Node 22 with the standard library only
// and writes the same bytes on every run.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps from the kit's reference/gate.json: keep the
// dossier text under 160 KiB, at most 4 screenshots of 256 KiB each,
// game/ under 993 files and 48 MiB, paths under 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const shots = readdirSync(join(out, 'screenshots')).sort();
// The gate refuses an entry with fewer than 3 screenshots, so fail
// loudly here instead of handing in a broken entry.
if (shots.length < 3) {
  throw new Error(`Solmara needs at least 3 screenshots, found ${shots.length}`);
}
const dossierBytes = readFileSync(join(out, 'dossier.json')).length;
console.log(`Solmara handed in: ${shots.length} screenshot(s) — ${shots.join(', ')} (dossier ${dossierBytes} bytes)`);
