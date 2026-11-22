// One Night at Meridian Bank — a stealth heist game for make.fun.
//
// Entry point for the browser game bounty. Running this program (under Node 22,
// no build, no install) stages the deliverable into the directory named by
// MAKEFUN_OUTPUT_DIR (falling back to /output when the variable is unset):
//
//   * the whole game/ folder (the playable game: game/index.html and game.js),
//   * the screenshots/ folder (the cover and three playthrough renders), and
//   * dossier.json, the metadata the make.fun gate compares, byte for byte,
//     against what its own scorer computes.
//
// It never touches the network, reads no clock and rolls no dice — the dossier
// is a pure function of the two folders staged beside this file.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// This source file's own directory, so the staged folders resolve no matter
// where Node is launched from.
const here = fileURLToPath(new URL('.', import.meta.url));

// Where the deliverable lands. The make.fun harness supplies MAKEFUN_OUTPUT_DIR;
// when absent, use the conventional default.
const landingDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Make room first, then stage the playable game tree wholesale.
mkdirSync(landingDir, { recursive: true });
cpSync(join(here, 'game'), join(landingDir, 'game'), { recursive: true });

// Screenshots are optional on disk but always expected in the output; prepare
// their folder, copying the local renders only when the entry actually ships any.
mkdirSync(join(landingDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(landingDir, 'screenshots'), { recursive: true });
}

// Build the dossier under the exact caps the bounty's gate.json names: 160 KiB
// of text, up to four screenshots at 256 KiB each, and a game tree of up to 993
// entries (files and directories, with the platform's own 1000-entry /output
// ceiling) totaling at most 48 MiB with no path past 1000 UTF-8 bytes.
writeFileSync(
  join(landingDir, 'dossier.json'),
  buildDossier(landingDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);