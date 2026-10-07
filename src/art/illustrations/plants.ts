import { ellipse, petalFlower, rng, scribble, wobble, type Pt } from '~/lib/wobble';
import type { IlloFactory } from '../types';

/** Seven irregular petals, one continuous line. The core motif of the site. */
export const sevenPetal: IlloFactory = (v) => ({
  w: 200,
  h: 200,
  alt: 'Цветок с семью лепестками, нарисованный одной линией',
  groups: [
    {
      life: 'sway-soft',
      origin: [100, 100],
      paths: [{ d: petalFlower({ cx: 100, cy: 100, petals: 7, inner: 9, len: [56, 90], rotation: -1.25 + v * 0.4, seed: 11 + v * 13, width: 0.3 }) }],
    },
  ],
});

/** single oblong petal loop around a centre */
function petalLoop(cx: number, cy: number, a: number, r0: number, r1: number, w: number): Pt[] {
  const P = (r: number, t: number): Pt => [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
  return [P(r0, a - w * 0.6), P((r0 + r1) / 2, a - w * 0.42), P(r1, a - w * 0.08), P(r1 * 0.98, a + w * 0.12), P((r0 + r1) / 2, a + w * 0.42), P(r0, a + w * 0.6)];
}

export const chamomile: IlloFactory = (v) => {
  const rand = rng(31 + v * 7);
  const cx = 80, cy = 66;
  const petals = Array.from({ length: 13 }, (_, i) => {
    const a = (i / 13) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const r1 = 36 + rand() * 12;
    return { d: wobble(petalLoop(cx, cy, a, 12, r1, 0.33), { closed: true, seed: 40 + i + v * 50, amp: 0.8, wave: 24, step: 5, overshoot: 0.08 }) };
  });
  return {
    w: 160,
    h: 240,
    alt: 'Ромашка на длинном стебле',
    groups: [
      {
        life: 'sway',
        origin: [80, 236],
        delay: -rand() * 6,
        paths: [
          { d: wobble([[80, 236], [77, 196], [84, 150], [79, 108], [80, 82]], { seed: 32 + v, amp: 1.4 }) },
          // feathery leaf
          { d: wobble([[81, 176], [98, 160], [112, 150], [126, 146], [112, 158], [98, 168], [82, 182]], { seed: 33 + v, amp: 1 }) },
          { d: wobble([[79, 132], [64, 120], [52, 116], [62, 126], [78, 138]], { seed: 34 + v, amp: 0.9 }) },
          ...petals,
          { d: ellipse(cx, cy, 12, 10, { seed: 35 + v, amp: 0.8, step: 4, k: 7 }) },
          { d: scribble({ cx, cy, rx: 9, ry: 7, gap: 3.4, seed: 36 + v, amp: 0.6 }), tone: 'accent' },
        ],
      },
    ],
  };
};

export const tulip: IlloFactory = (v) => ({
  w: 140,
  h: 240,
  alt: 'Тюльпан с длинным листом',
  groups: [
    {
      life: 'sway',
      origin: [70, 236],
      delay: -2.4 - v,
      paths: [
        { d: wobble([[70, 236], [72, 200], [65, 160], [70, 126]], { seed: 51 + v, amp: 1.5 }) },
        { d: wobble([[71, 214], [50, 186], [36, 150], [40, 118], [52, 146], [62, 176], [70, 200]], { seed: 52 + v, amp: 1.1, closed: true, overshoot: 0.05 }) },
        {
          d: wobble(
            [[52, 124], [44, 100], [46, 74], [56, 86], [63, 60], [72, 84], [82, 58], [88, 84], [97, 70], [98, 100], [90, 122], [72, 130]],
            { seed: 53 + v, amp: 1.2, closed: true, overshoot: 0.07 },
          ),
        },
        { d: wobble([[63, 66], [66, 98], [72, 124]], { seed: 54 + v, amp: 0.8 }), tone: 'accent' },
      ],
    },
  ],
});

export const grassTuft: IlloFactory = (v) => {
  const rand = rng(61 + v * 11);
  const blades = Array.from({ length: 8 }, (_, i) => {
    const bx = 46 + i * 9.5 + (rand() - 0.5) * 6;
    const h = 40 + rand() * 50;
    const lean = (i - 3.5) * 5 + (rand() - 0.5) * 22;
    return {
      d: wobble([[bx, 98], [bx + lean * 0.25, 98 - h * 0.5], [bx + lean, 98 - h]], { seed: 62 + i + v * 20, amp: 0.9, wave: 30, jitter: 0.6 }),
      tone: (i % 3 === 1 ? 'accent' : 'line') as 'accent' | 'line',
    };
  });
  return {
    w: 160,
    h: 100,
    alt: 'Пучок травы',
    groups: [{ life: 'sway-soft', origin: [80, 98], delay: -rand() * 5, paths: blades }],
  };
};

export const fern: IlloFactory = (v) => {
  const rand = rng(71 + v * 5);
  const spine: Pt[] = [[60, 236], [62, 190], [70, 140], [86, 96], [104, 62]];
  const leaves = [] as { d: string }[];
  for (let i = 0; i < 9; i++) {
    const t = 0.12 + i * 0.095;
    const y = 236 - t * 180;
    const x = 60 + t * t * 50;
    const L = 30 * (1 - t * 0.7) + rand() * 6;
    for (const side of [-1, 1]) {
      leaves.push({
        d: wobble([[x, y], [x + side * L * 0.6, y - L * 0.35], [x + side * L, y - L * 0.6 - (side > 0 ? 6 : 0)]], { seed: 72 + i * 2 + (side > 0 ? 1 : 0) + v * 40, amp: 0.7, jitter: 1.2 }),
      });
    }
  }
  return {
    w: 160,
    h: 240,
    alt: 'Папоротник',
    groups: [{ life: 'sway', origin: [60, 236], delay: -1.3, paths: [{ d: wobble(spine, { seed: 70 + v, amp: 1.3 }) }, ...leaves] }],
  };
};

