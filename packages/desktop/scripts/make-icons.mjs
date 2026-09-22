import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const outDir = fileURLToPath(new URL("../build", import.meta.url));
mkdirSync(outDir, { recursive: true });

const FROM = [79, 125, 255];
const TO = [111, 160, 255];
const DARK = [12, 15, 23];

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function coverage(distance, softness = 1.1) {
  return clamp01(0.5 - distance / softness);
}

function roundedRect(x, y, size, radius) {
  const dx = Math.abs(x - size / 2) - (size / 2 - radius);
  const dy = Math.abs(y - size / 2) - (size / 2 - radius);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const t = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function renderMark(size) {
  const pixels = new Uint8Array(size * size * 4);
  const pad = size * 0.02;
  const box = size - pad * 2;
  const radius = size * 0.22;
  const stroke = size * 0.075;
  const top = pad + box * 0.3;
  const bottom = pad + box * 0.72;
  const left = pad + box * 0.24;
  const right = pad + box * 0.76;
  const midX = size / 2;
  const midY = pad + box * 0.56;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const t = clamp01((x / size) * 0.6 + (y / size) * 0.4);
      const base = mix(FROM, TO, t);

      const inside = coverage(roundedRect(x + 0.5, y + 0.5, size, radius));
      if (inside <= 0) {
        pixels[index + 3] = 0;
        continue;
      }

      const d = Math.min(
        segmentDistance(x, y, left, top, left, bottom),
        segmentDistance(x, y, right, top, right, bottom),
        segmentDistance(x, y, left, top, midX, midY),
        segmentDistance(x, y, right, top, midX, midY),
      );
      const letter = coverage(d - stroke / 2, 1.6);
      const color = mix(base, [255, 255, 255], letter);
      pixels[index] = Math.round(color[0]);
      pixels[index + 1] = Math.round(color[1]);
      pixels[index + 2] = Math.round(color[2]);
      pixels[index + 3] = Math.round(inside * 255);
    }
  }
  return pixels;
}

function renderPanel(width, height) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = clamp01((x / width) * 0.5 + (y / height) * 0.5);
      const glow = Math.hypot(x - width * 0.3, y - height * 0.18) / (Math.hypot(width, height) * 0.8);
      const shade = mix(DARK, mix(FROM, TO, t), clamp01(0.3 * (1 - glow)));
      const index = (y * width + x) * 4;
      pixels[index] = Math.round(shade[0]);
      pixels[index + 1] = Math.round(shade[1]);
      pixels[index + 2] = Math.round(shade[2]);
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

function downscale(pixels, size, target) {
  const out = new Uint8Array(target * target * 4);
  const scale = size / target;
  for (let y = 0; y < target; y += 1) {
    for (let x = 0; x < target; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = Math.floor(y * scale); sy < Math.floor((y + 1) * scale); sy += 1) {
        for (let sx = Math.floor(x * scale); sx < Math.floor((x + 1) * scale); sx += 1) {
          const i = (sy * size + sx) * 4;
          r += pixels[i];
          g += pixels[i + 1];
          b += pixels[i + 2];
          a += pixels[i + 3];
          count += 1;
        }
      }
      const o = (y * target + x) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round(a / count);
    }
  }
  return out;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function toPng(pixels, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function toIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  const images = [];
  entries.forEach((entry, index) => {
    const base = index * 16;
    directory[base] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 2] = 0;
    directory[base + 3] = 0;
    directory.writeUInt16LE(1, base + 4);
    directory.writeUInt16LE(32, base + 6);
    directory.writeUInt32LE(entry.png.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += entry.png.length;
    images.push(entry.png);
  });
  return Buffer.concat([header, directory, ...images]);
}

function toBmp(pixels, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const dataSize = rowSize * height;
  const header = Buffer.alloc(54);
  header.write("BM", 0, "ascii");
  header.writeUInt32LE(54 + dataSize, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(dataSize, 34);
  const body = Buffer.alloc(dataSize);
  for (let y = 0; y < height; y += 1) {
    const source = (height - 1 - y) * width * 4;
    const target = y * rowSize;
    for (let x = 0; x < width; x += 1) {
      const i = source + x * 4;
      body[target + x * 3] = pixels[i + 2];
      body[target + x * 3 + 1] = pixels[i + 1];
      body[target + x * 3 + 2] = pixels[i];
    }
  }
  return Buffer.concat([header, body]);
}

function logoLayer(width, height, markSize, offsetX, offsetY, canvas) {
  const mark = renderMark(markSize);
  for (let y = 0; y < markSize; y += 1) {
    for (let x = 0; x < markSize; x += 1) {
      const src = (y * markSize + x) * 4;
      const dx = x + offsetX;
      const dy = y + offsetY;
      if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;
      const dst = (dy * width + dx) * 4;
      const alpha = mark[src + 3] / 255;
      if (alpha <= 0) continue;
      for (let c = 0; c < 3; c += 1) {
        canvas[dst + c] = Math.round(canvas[dst + c] * (1 - alpha) + mark[src + c] * alpha);
      }
      canvas[dst + 3] = 255;
    }
  }
}

const master = renderMark(512);
writeFileSync(path.join(outDir, "icon.png"), toPng(master, 512));

const sizes = [16, 24, 32, 48, 64, 128, 256];
writeFileSync(
  path.join(outDir, "icon.ico"),
  toIco(sizes.map((size) => ({ size, png: toPng(downscale(master, 512, size), size) }))),
);

const sidebar = renderPanel(164, 314);
logoLayer(164, 314, 96, 34, 90, sidebar);
writeFileSync(path.join(outDir, "installerSidebar.bmp"), toBmp(sidebar, 164, 314));
writeFileSync(path.join(outDir, "uninstallerSidebar.bmp"), toBmp(sidebar, 164, 314));

const header = renderPanel(150, 57);
logoLayer(150, 57, 36, 12, 10, header);
writeFileSync(path.join(outDir, "installerHeader.bmp"), toBmp(header, 150, 57));

console.log("icons written to", outDir);
