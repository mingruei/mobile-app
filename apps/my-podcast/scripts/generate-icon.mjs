import { deflateSync, inflateSync } from 'zlib';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'assets', 'icon-source.png');
const outputs = [
  join(root, 'assets', 'icon.png'),
  join(root, 'targets', 'watch', 'Assets.xcassets', 'AppIcon.appiconset', 'App-Icon-1024x1024@1x.png'),
];

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
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4;
      const dest = rowStart + 1 + x * 3;
      raw[dest] = rgba[src];
      raw[dest + 1] = rgba[src + 1];
      raw[dest + 2] = rgba[src + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function readPng(path) {
  const file = readFileSync(path);
  if (file.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (colorType !== 2) throw new Error('需要沒有透明色的 RGB PNG');
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const rgba = Buffer.alloc(width * height * 4);
  let input = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[input];
    input += 1;
    const row = Buffer.from(inflated.subarray(input, input + stride));
    input += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= 3 ? row[i - 3] : 0;
      const up = prev[i];
      const upLeft = i >= 3 ? prev[i - 3] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + up) & 255;
      else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const paeth = paethPredictor(left, up, upLeft);
        row[i] = (row[i] + paeth) & 255;
      }
    }
    prev = row;
    for (let x = 0; x < width; x += 1) {
      const dest = (y * width + x) * 4;
      rgba[dest] = row[x * 3];
      rgba[dest + 1] = row[x * 3 + 1];
      rgba[dest + 2] = row[x * 3 + 2];
      rgba[dest + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const pa = Math.abs(estimate - left);
  const pb = Math.abs(estimate - up);
  const pc = Math.abs(estimate - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function isBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return min > 210 && max - min < 30;
}

function artworkBounds(width, height, rgba) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (isBackground(rgba[index], rgba[index + 1], rgba[index + 2])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function sample(rgba, width, height, x, y) {
  const sx = Math.max(0, Math.min(width - 1, x));
  const sy = Math.max(0, Math.min(height - 1, y));
  const index = (sy * width + sx) * 4;
  return [rgba[index], rgba[index + 1], rgba[index + 2]];
}

function iconColorAt(rgba, width, height, x, y, centerX, centerY) {
  for (let step = 1; step <= 32; step += 1) {
    const t = step / 32;
    const sx = Math.round(x + (centerX - x) * t);
    const sy = Math.round(y + (centerY - y) * t);
    const color = sample(rgba, width, height, sx, sy);
    if (!isBackground(color[0], color[1], color[2])) return color;
  }
  return sample(rgba, width, height, Math.round(centerX), Math.round(centerY));
}

function fillIcon(source, size) {
  const { width, height, rgba } = source;
  const bounds = artworkBounds(width, height, rgba);
  const inset = 3;
  bounds.minX += inset;
  bounds.minY += inset;
  bounds.maxX -= inset;
  bounds.maxY -= inset;
  const cropW = bounds.maxX - bounds.minX + 1;
  const cropH = bounds.maxY - bounds.minY + 1;
  const pixels = Buffer.alloc(size * size * 4);
  const centerX = bounds.minX + cropW / 2;
  const centerY = bounds.minY + cropH / 2;
  for (let y = 0; y < size; y += 1) {
    const sy = bounds.minY + ((y + 0.5) * cropH) / size - 0.5;
    for (let x = 0; x < size; x += 1) {
      const sx = bounds.minX + ((x + 0.5) * cropW) / size - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const tx = sx - x0;
      const ty = sy - y0;
      const c00 = sample(rgba, width, height, x0, y0);
      const c10 = sample(rgba, width, height, x0 + 1, y0);
      const c01 = sample(rgba, width, height, x0, y0 + 1);
      const c11 = sample(rgba, width, height, x0 + 1, y0 + 1);
      const dest = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const top = c00[channel] * (1 - tx) + c10[channel] * tx;
        const bottom = c01[channel] * (1 - tx) + c11[channel] * tx;
        pixels[dest + channel] = Math.round(top * (1 - ty) + bottom * ty);
      }
      if (isBackground(pixels[dest], pixels[dest + 1], pixels[dest + 2])) {
        const filled = iconColorAt(rgba, width, height, sx, sy, centerX, centerY);
        pixels[dest] = filled[0];
        pixels[dest + 1] = filled[1];
        pixels[dest + 2] = filled[2];
      }
      pixels[dest + 3] = 255;
    }
  }
  return pixels;
}

const source = readPng(sourcePath);
const icon = writePng(1024, 1024, fillIcon(source, 1024));
for (const output of outputs) writeFileSync(output, icon);
