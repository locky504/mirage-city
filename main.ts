// Mirage City — Desert Heat Run: build entrypoint for the gta6-01 "Make GTA 6" bounty.
//
// The game itself is an original open-world crime game set in a fictional desert
// city: driving, combat and jobs across a three.js city, all from the plain static
// files in game/ (game/index.html plus its ES modules, loaded offline with no
// network requests). This file is not the game; it is the packager that turns the
// finished game into the submission bundle the judge reads. The bundle layout is:
//   <output>/game/         — the playable game, copied over verbatim
//   <output>/screenshots/  — up to 4 PNG or JPEG shots; the first by name is the cover
//   <output>/dossier.json  — the entry summary, built by the vendored make.fun library
//
// Run it locally with MAKEFUN_OUTPUT_DIR=out node main.ts. Inside the grader the
// output directory is /output instead; serve the result with `node serve.ts`.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly before copying anything if an input the bundle cannot do without
// is absent, instead of quietly shipping an empty or broken entry.
const mustExist = [join(here, 'game'), join(here, 'game', 'index.html')];
for (const needed of mustExist) {
  if (!existsSync(needed)) {
    throw new Error(`Mirage City build failed: required input is missing: ${needed}`);
  }
}

// Count every file under a directory, descending into subfolders, for the summary below.
function countFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
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

// One short line once the bundle is complete, so a builder can see at a glance
// what actually landed in the output directory.
const shotCount = readdirSync(join(out, 'screenshots')).length;
console.log(
  `Mirage City build done: ${countFiles(join(out, 'game'))} game files, ` +
    `${shotCount} screenshots, dossier at ${join(out, 'dossier.json')}`,
);
