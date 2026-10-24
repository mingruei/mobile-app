import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
mkdirSync(assetsDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([header, typeBuf, data, crcBuf]);
}

function writePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPixel(pixels, width, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const i = (y * width + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = 255;
}

function fillCircle(pixels, width, cx, cy, radius, r, g, b) {
  const r2 = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(pixels, width, x, y, r, g, b);
    }
  }
}

function drawHand(pixels, width, cx, cy, length, angle, thickness, r, g, b) {
  const steps = Math.ceil(length);
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(cx + Math.cos(angle) * i);
    const y = Math.round(cy + Math.sin(angle) * i);
    for (let t = -thickness; t <= thickness; t += 1) {
      setPixel(pixels, width, x + t, y, r, g, b);
      setPixel(pixels, width, x, y + t, r, g, b);
    }
  }
}

function generateIcon() {
  const size = 1024;
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 242;
    pixels[i + 1] = 183;
    pixels[i + 2] = 5;
    pixels[i + 3] = 255;
  }
  const cx = 512;
  const cy = 540;
  fillCircle(pixels, size, cx, cy, 340, 32, 24, 12);
  fillCircle(pixels, size, cx, cy, 300, 255, 248, 230);
  fillCircle(pixels, size, 360, 220, 48, 32, 24, 12);
  fillCircle(pixels, size, 664, 220, 48, 32, 24, 12);
  for (let y = 140; y < 230; y += 1) {
    for (let x = 340; x < 390; x += 1) setPixel(pixels, size, x, y, 32, 24, 12);
    for (let x = 634; x < 684; x += 1) setPixel(pixels, size, x, y, 32, 24, 12);
  }
  for (let y = 120; y < 170; y += 1) {
    for (let x = 340; x < 684; x += 1) setPixel(pixels, size, x, y, 32, 24, 12);
  }
  const marks = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  for (const angle of marks) {
    const x = Math.round(cx + Math.cos(angle) * 240);
    const y = Math.round(cy + Math.sin(angle) * 240);
    fillCircle(pixels, size, x, y, 22, 32, 24, 12);
  }
  drawHand(pixels, size, cx, cy, 160, -Math.PI / 2 + 0.5, 14, 32, 24, 12);
  drawHand(pixels, size, cx, cy, 230, -Math.PI / 2 + 2.2, 10, 196, 40, 28);
  fillCircle(pixels, size, cx, cy, 28, 196, 40, 28);
  writeFileSync(join(assetsDir, 'icon.png'), writePng(size, size, pixels));
}

function writeWav(fileName, sampleRate, data) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(assetsDir, fileName), Buffer.concat([header, data]));
}

function generateWav() {
  const sampleRate = 22050;
  const durationSec = 29;
  const samples = Math.floor(sampleRate * durationSec);
  const data = Buffer.alloc(samples * 2);
  const beepHz = [880, 698];
  const onSamples = Math.floor(sampleRate * 0.35);
  const offSamples = Math.floor(sampleRate * 0.15);
  const cycle = onSamples + offSamples;

  for (let i = 0; i < samples; i += 1) {
    const inCycle = i % cycle;
    const beepIndex = Math.floor(i / cycle) % beepHz.length;
    let value = 0;
    if (inCycle < onSamples) {
      const t = i / sampleRate;
      value = Math.sin(2 * Math.PI * beepHz[beepIndex] * t) * 0.85;
      const fade = Math.min(inCycle, onSamples - inCycle, 400) / 400;
      value *= fade;
    }
    data.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  writeWav('alarm.wav', sampleRate, data);
}

function generateKeepAliveWav() {
  const sampleRate = 22050;
  const samples = Math.floor(sampleRate * 2);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    const noise = (Math.random() * 2 - 1) * 0.004;
    data.writeInt16LE(Math.round(noise * 32767), i * 2);
  }
  writeWav('keepalive.wav', sampleRate, data);
}

generateIcon();
generateWav();
generateKeepAliveWav();
console.log('Wrote assets/icon.png, assets/alarm.wav, and assets/keepalive.wav');
