import { ellipse, line, scribble, wobble, type Pt } from '~/lib/wobble';
import type { IlloFactory } from '../types';

/** Sitting cat, facing left. Simple and a bit silly — never a mascot. */
export const cat: IlloFactory = (v) => {
  const body: Pt[] = [
    [60, 182], [55, 150], [53, 118], [57, 97],
    [46, 84], [43, 66], [49, 52], [51, 29], [65, 44],
    [80, 41], [90, 42], [101, 25], [99, 52], [101, 70],
    [105, 89], [128, 104], [146, 130], [152, 158], [145, 179],
    [102, 184], [64, 183],
  ];
  return {
    w: 200,
    h: 200,
    alt: 'Сидящий кот, нарисованный дрожащей линией',
    groups: [
      {
        paths: [
          { d: scribble({ cx: 108, cy: 146, rx: 36, ry: 34, angle: -0.7, gap: 8, seed: 81 + v, amp: 1.8 }), tone: 'fill', fillOnly: true },
          { d: wobble(body, { seed: 82 + v * 9, amp: 1.6, wave: 40, closed: true, overshoot: 0.04 }) },
          // front leg
          { d: wobble([[72, 140], [70, 166], [74, 183]], { seed: 83 + v, amp: 0.9 }) },
          { d: wobble([[60, 183], [66, 178], [74, 183]], { seed: 84 + v, amp: 0.6 }) },
          // nose, mouth, whiskers
          { d: wobble([[47, 76], [51, 79], [48, 82]], { seed: 85 + v, amp: 0.4 }) },
          { d: line([30, 74], [50, 78], { seed: 86 + v, amp: 0.5, sag: 1 }), tone: 'accent' },
          { d: line([31, 84], [50, 81], { seed: 87 + v, amp: 0.5, sag: -1 }), tone: 'accent' },
        ],
      },
      {
        life: 'blink',
        origin: [66, 64],
        paths: [
          { d: line([57, 61], [58, 68], { seed: 88 + v, amp: 0.3 }), w: 1.2 },
          { d: line([75, 60], [75, 67], { seed: 89 + v, amp: 0.3 }), w: 1.2 },
        ],
      },
      {
        life: 'tail',
        origin: [146, 176],
        paths: [{ d: wobble([[146, 176], [170, 180], [188, 168], [191, 146], [181, 135], [176, 142]], { seed: 90 + v, amp: 1.2 }) }],
      },
    ],
  };
};

/** Heron standing in shallow water; dips its beak now and then. */
export const heron: IlloFactory = (v) => ({
  w: 170,
  h: 240,
  alt: 'Цапля стоит в воде',
  groups: [
    {
      paths: [
        { d: wobble([[66, 98], [82, 83], [110, 82], [134, 91], [158, 104], [130, 112], [100, 117], [75, 111]], { seed: 101 + v, amp: 1.3, closed: true, overshoot: 0.06 }) },
        { d: wobble([[86, 97], [110, 94], [136, 101]], { seed: 102 + v, amp: 0.8 }) },
        // legs with a knee
        { d: wobble([[98, 116], [97, 158], [99, 202]], { seed: 103 + v, amp: 0.9 }) },
        { d: wobble([[110, 115], [114, 160], [117, 202]], { seed: 104 + v, amp: 0.9 }) },
        { d: line([99, 202], [84, 208], { seed: 105 + v, amp: 0.4 }) },
        { d: line([99, 202], [101, 211], { seed: 106 + v, amp: 0.4 }) },
        { d: line([117, 202], [131, 207], { seed: 107 + v, amp: 0.4 }) },
        // water
        { d: wobble([[40, 214], [70, 210], [100, 215], [130, 211], [158, 214]], { seed: 108 + v, amp: 1.1, wave: 20 }), tone: 'accent' },
        { d: wobble([[66, 226], [96, 223], [122, 226]], { seed: 109 + v, amp: 0.9, wave: 20 }), tone: 'accent' },
      ],
    },
    {
      life: 'dip',
      origin: [70, 96],
      paths: [
        { d: wobble([[70, 94], [58, 80], [61, 62], [71, 50], [64, 40]], { seed: 110 + v, amp: 1.1 }) },
        { d: ellipse(56, 36, 9, 6.5, { seed: 111 + v, amp: 0.6, step: 4, k: 7 }) },
        { d: wobble([[48, 33], [20, 42], [47, 39]], { seed: 112 + v, amp: 0.5, jitter: 0.4 }), tone: 'accent' },
        { d: line([56, 34], [57, 35], { seed: 113, amp: 0.1 }), w: 1.6 },
        // plume
        { d: wobble([[62, 31], [76, 26], [86, 30]], { seed: 114 + v, amp: 0.6 }) },
      ],
    },
  ],
});

function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, a0 = 0): Pt[] {
  const pts: Pt[] = [];
  const n = Math.round(turns * 9);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92]);
  }
  return pts;
}

export const snail: IlloFactory = (v) => ({
  w: 180,
  h: 120,
  alt: 'Улитка',
  groups: [
    {
      life: 'crawl',
      origin: [158, 100],
      paths: [
        { d: wobble(spiral(104, 62, 3, 36, 2.4, 0.4), { seed: 121 + v, amp: 1.1, wave: 30, step: 5 }) },
        { d: wobble([[158, 100], [126, 103], [86, 103], [50, 101], [35, 94], [31, 79], [39, 71], [50, 78], [58, 92], [72, 94]], { seed: 122 + v, amp: 1.1 }) },
        { d: wobble([[37, 74], [29, 58], [26, 46]], { seed: 123 + v, amp: 0.6 }) },
        { d: wobble([[44, 74], [46, 56], [49, 45]], { seed: 124 + v, amp: 0.6 }) },
        { d: ellipse(25.5, 43, 2.6, 2.6, { seed: 125, amp: 0.2, step: 3, k: 5 }), tone: 'accent' },
        { d: ellipse(49.5, 42, 2.6, 2.6, { seed: 126, amp: 0.2, step: 3, k: 5 }), tone: 'accent' },
        { d: scribble({ cx: 104, cy: 62, rx: 30, ry: 28, gap: 7, angle: 0.6, seed: 127 + v, amp: 1.5 }), tone: 'fill', fillOnly: true },
      ],
    },
  ],
});

export const bird: IlloFactory = (v) => ({
  w: 120,
  h: 100,
  alt: 'Маленькая птичка',
  groups: [
    {
      life: 'hop',
      origin: [60, 92],
      paths: [
        { d: wobble([[30, 52], [40, 36], [60, 30], [78, 37], [86, 50], [80, 65], [60, 72], [40, 68], [30, 54], [12, 44], [17, 59], [31, 61]], { seed: 131 + v, amp: 1, closed: true, overshoot: 0.04 }) },
        { d: wobble([[85, 45], [99, 48], [85, 53]], { seed: 132 + v, amp: 0.4, jitter: 0.3 }), tone: 'accent' },
        { d: wobble([[44, 50], [56, 56], [68, 54]], { seed: 133 + v, amp: 0.6 }) },
        { d: line([54, 71], [52, 89], { seed: 134 + v, amp: 0.4 }) },
        { d: line([64, 71], [65, 89], { seed: 135 + v, amp: 0.4 }) },
        { d: wobble([[46, 90], [52, 89], [58, 91]], { seed: 136, amp: 0.3 }) },
        { d: wobble([[60, 90], [65, 89], [71, 91]], { seed: 137, amp: 0.3 }) },
        { d: scribble({ cx: 56, cy: 52, rx: 20, ry: 13, gap: 5, seed: 138 + v, amp: 1 }), tone: 'fill', fillOnly: true },
      ],
    },
    {
      life: 'blink',
      origin: [74, 44],
      paths: [{ d: line([74, 42], [74.5, 46], { seed: 139, amp: 0.1 }), w: 1.4 }],
    },
  ],
});
