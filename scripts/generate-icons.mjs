/**
 * Generates the app icons from the FoodLens mark.
 *
 * The mark is a vesica - the overlap of two circles - which reads as a lens
 * and as a leaf at the same time. It is defined by geometry rather than drawn,
 * so the same numbers here and in src/components/BrandMark.tsx produce the
 * same shape, and the icon cannot drift from the mark used in the app.
 *
 * Writes PNGs directly with zlib, so this needs no image library:
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');

/**
 * Shared with BrandMark. Expressed on a 0..1 grid.
 *
 * The lens is specified by the half-width and half-height we want, and the
 * two generating circles are solved from those. Specifying the circles
 * directly is how the first attempt produced a sliver: a vesica is always
 * taller than it is wide, so the radius has to come out of the proportions
 * rather than the other way round.
 *
 *   halfWidth  = R - d
 *   halfHeight = sqrt(R^2 - d^2)
 * so
 *   R = (halfWidth^2 + halfHeight^2) / (2 * halfWidth)
 *   d = R - halfWidth
 */
const GEOMETRY = {
  halfWidth: 0.30,
  halfHeight: 0.40,
  /** Tilt, in degrees. Enough to read as a leaf rather than an eye. */
  tilt: -18,
  tileRadius: 0.22,
  veinWidth: 0.055,
  veinInset: 0.07,
};

const LENS = (() => {
  const { halfWidth, halfHeight } = GEOMETRY;
  const radius = (halfWidth ** 2 + halfHeight ** 2) / (2 * halfWidth);
  return { radius, offset: radius - halfWidth };
})();

const TILT = (GEOMETRY.tilt * Math.PI) / 180;

/** Rotates a point about the centre of the grid, against the tilt. */
function untilt(x, y) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  return [
    0.5 + dx * Math.cos(-TILT) - dy * Math.sin(-TILT),
    0.5 + dx * Math.sin(-TILT) + dy * Math.cos(-TILT),
  ];
}

const COLORS = {
  /**
   * The brand tile. A deep crimson, the darkest step of the same red the
   * buttons and every selected control use, so the launcher icon belongs to
   * the app it opens. It was forest green while green was the interface
   * accent; green is now a data colour and lives inside the charts.
   */
  brand: [0x9e, 0x1a, 0x28],
  paper: [0xfa, 0xf8, 0xf4],
  white: [0xff, 0xff, 0xff],
};

/** 4x4 supersampling, which is enough to hide stair-stepping on a curve. */
const SAMPLES = 4;

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encodes RGBA pixel data as a PNG. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate, default filter, no interlace.

  // One filter byte per scanline, filter type 0.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** True when a point on the 0..1 grid is inside the lens. */
function insideLens(px, py) {
  const [x, y] = untilt(px, py);
  const { radius, offset } = LENS;
  const left = (x - (0.5 - offset)) ** 2 + (y - 0.5) ** 2 <= radius ** 2;
  const right = (x - (0.5 + offset)) ** 2 + (y - 0.5) ** 2 <= radius ** 2;
  return left && right;
}

/** True when a point is on the central vein. */
function insideVein(px, py) {
  const [x, y] = untilt(px, py);
  const { halfHeight, veinWidth, veinInset } = GEOMETRY;
  const halfSpan = halfHeight - veinInset;
  return Math.abs(x - 0.5) <= veinWidth / 2 && Math.abs(y - 0.5) <= halfSpan;
}

/** True when a point is inside a rounded square covering the whole canvas. */
function insideTile(x, y) {
  const r = GEOMETRY.tileRadius;
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

/**
 * Renders one icon.
 *
 * @param {object} options
 * @param {number} options.size            Pixel dimensions.
 * @param {boolean} options.tile           Draw the enclosing rounded square.
 * @param {number[]|null} options.tileColor Tile fill, or null for transparent.
 * @param {number[]} options.markColor     Lens fill.
 * @param {number[]|null} options.veinColor Vein fill, or null to omit it.
 * @param {number} options.scale           Mark size relative to the canvas.
 */
function render({ size, tile, tileColor, markColor, veinColor, scale = 1 }) {
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let tileHits = 0;
      let markHits = 0;
      let veinHits = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;
          // Scale the mark about the centre without moving the tile.
          const mx = (x - 0.5) / scale + 0.5;
          const my = (y - 0.5) / scale + 0.5;

          if (tile && insideTile(x, y)) tileHits += 1;
          if (insideLens(mx, my)) {
            markHits += 1;
            if (insideVein(mx, my)) veinHits += 1;
          }
        }
      }

      const total = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 4;

      // Composite back to front: tile, lens, vein.
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      const put = (color, coverage) => {
        if (coverage <= 0) return;
        const alpha = coverage;
        r = color[0] * alpha + r * (1 - alpha);
        g = color[1] * alpha + g * (1 - alpha);
        b = color[2] * alpha + b * (1 - alpha);
        a = alpha + a * (1 - alpha);
      };

      if (tile && tileColor) put(tileColor, tileHits / total);
      put(markColor, markHits / total);
      if (veinColor) put(veinColor, veinHits / total);

      rgba[offset] = Math.round(r);
      rgba[offset + 1] = Math.round(g);
      rgba[offset + 2] = Math.round(b);
      rgba[offset + 3] = Math.round(a * 255);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(ASSETS, { recursive: true });

const OUTPUTS = [
  // iOS and the store listing: the full tile.
  {
    file: 'icon.png',
    options: {
      size: 1024,
      tile: true,
      tileColor: COLORS.brand,
      markColor: COLORS.paper,
      veinColor: COLORS.brand,
      scale: 0.80,
    },
  },
  // Android adaptive icon: the mark alone, inside the 66% safe area, on a
  // transparent background. Android masks and animates these separately.
  {
    file: 'android-icon-foreground.png',
    options: {
      size: 1024,
      tile: false,
      tileColor: null,
      markColor: COLORS.paper,
      veinColor: COLORS.brand,
      scale: 0.52,
    },
  },
  {
    file: 'android-icon-background.png',
    options: {
      size: 1024,
      tile: true,
      tileColor: COLORS.brand,
      markColor: COLORS.brand,
      veinColor: null,
      scale: 0.0001,
    },
  },
  // Monochrome, for Android themed icons: one flat silhouette.
  {
    file: 'android-icon-monochrome.png',
    options: {
      size: 1024,
      tile: false,
      tileColor: null,
      markColor: COLORS.white,
      veinColor: null,
      scale: 0.52,
    },
  },
  // Splash: the mark on transparent, so the configured background shows.
  {
    file: 'splash-icon.png',
    options: {
      size: 512,
      tile: false,
      tileColor: null,
      markColor: COLORS.brand,
      veinColor: COLORS.paper,
      scale: 0.88,
    },
  },
  {
    file: 'favicon.png',
    options: {
      size: 64,
      tile: true,
      tileColor: COLORS.brand,
      markColor: COLORS.paper,
      veinColor: COLORS.brand,
      scale: 0.80,
    },
  },
];

for (const { file, options } of OUTPUTS) {
  const png = render(options);
  writeFileSync(join(ASSETS, file), png);
  console.log(`${file.padEnd(32)} ${options.size}x${options.size}  ${(png.length / 1024).toFixed(1)} KB`);
}
