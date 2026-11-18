// Port Vireo — entrypoint for gta6-01 (Node 22, standard library only).
// Hands in the game: copies game/ and screenshots/ beside this file into the
// output directory and writes /output/dossier.json with the vendored make.fun
// library. The game itself is plain static files a desktop browser loads
// offline: game/index.html and its ES modules, no libraries, no network.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

// The scorer's caps, mirrored here so a bad entry is refused before it ships:
// at most 4 screenshots of 256 KiB, at most 993 files / 48 MiB under game/,
// no path under game/ longer than 1000 bytes. Only text_max_bytes shapes the
// dossier's bytes; the rest refuse what the scorer would refuse.
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
