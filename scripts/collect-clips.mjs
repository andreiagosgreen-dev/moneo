#!/usr/bin/env node
/**
 * Turns the marketing recordings (marketing/recorder) into upload-ready MP4s:
 * cuts the setup part, 1080×1920, 30 fps, H.264, no audio track.
 * Output: clips/<lang>-<clip>.mp4
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const META = 'test-results/clip-meta';
const OUT = 'clips';

if (!existsSync(META)) {
  console.error('No recordings found. Run the recorder first.');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

let made = 0;
for (const file of readdirSync(META).filter((f) => f.endsWith('.json'))) {
  const meta = JSON.parse(readFileSync(join(META, file), 'utf8'));
  if (!meta.video || !existsSync(meta.video)) {
    console.warn(`skip ${meta.name}: no video`);
    continue;
  }
  const out = join(OUT, `${meta.name}.mp4`);
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-ss',
      String(Math.max(0, meta.trim)),
      '-i',
      meta.video,
      '-vf',
      'scale=1080:1920:flags=lanczos,fps=30',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      out,
    ],
    { stdio: 'inherit' },
  );
  console.log(`made ${out}`);
  made += 1;
}
console.log(`${made} clip(s) in ${OUT}/`);
if (made === 0) process.exit(1);
