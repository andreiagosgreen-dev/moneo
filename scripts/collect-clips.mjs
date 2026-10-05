#!/usr/bin/env node
/**
 * Turns the marketing recordings (marketing/recorder) into upload-ready MP4s:
 * 1080×1920, 30 fps, H.264, no audio track.
 * Input: test-results/clip-frames/<name>/frames.txt (ffconcat list)
 * Output: clips/<name>.mp4
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FRAMES = 'test-results/clip-frames';
const OUT = 'clips';

if (!existsSync(FRAMES)) {
  console.error('No recordings found. Run the recorder first.');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

let made = 0;
for (const name of readdirSync(FRAMES).sort()) {
  const list = join(FRAMES, name, 'frames.txt');
  if (!existsSync(list)) {
    console.warn(`skip ${name}: no frames`);
    continue;
  }
  const out = join(OUT, `${name}.mp4`);
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-vf',
      'scale=1080:1920:flags=lanczos:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1,fps=30,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
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
