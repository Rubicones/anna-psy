import { ellipse, line, rng, scribble, wobble, type Pt } from '~/lib/wobble';
import type { IlloFactory } from '../types';

export const sun: IlloFactory = (v) => {
  const rand = rng(141 + v * 3);
  const rays = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    const r0 = 44 + rand() * 4;
    const r1 = 62 + rand() * 18;
    return { d: line([100 + Math.cos(a) * r0, 100 + Math.sin(a) * r0], [100 + Math.cos(a) * r1, 100 + Math.sin(a) * r1], { seed: 142 + i + v * 30, amp: 0.8, sag: (rand() - 0.5) * 4 }) };
  });
  return {
    w: 200,
    h: 200,
    alt: 'Солнце',
    groups: [
      {
        paths: [
          { d: scribble({ cx: 100, cy: 100, rx: 28, ry: 27, gap: 6, angle: -0.4, seed: 155 + v, amp: 1.3 }), tone: 'fill', fillOnly: true },
          { d: ellipse(100, 100, 34, 32, { seed: 156 + v, amp: 1.2, k: 8 }) },
        ],
      },
      { life: 'spin', origin: [100, 100], paths: rays },
    ],
  };
};

export const moon: IlloFactory = (v) => ({
  w: 140,
  h: 140,
  alt: 'Месяц',
  groups: [
    {
      life: 'bob',
      origin: [70, 70],
      paths: [
        { d: wobble([[86, 20], [52, 28], [34, 62], [44, 100], [80, 118], [112, 104], [84, 96], [66, 74], [68, 44]], { seed: 161 + v, amp: 1.1, closed: true, overshoot: 0.05 }) },
        { d: line([64, 64], [65, 68], { seed: 162, amp: 0.1 }), w: 1.4 },
        { d: wobble([[62, 82], [68, 86], [75, 84]], { seed: 163, amp: 0.3 }), tone: 'accent' },
      ],
    },
  ],
});

/** wonky asterisk-star */
export const star: IlloFactory = (v) => {
  const rand = rng(171 + v * 7);
  const arms = 5 + (v % 2);
  const pts: Pt[] = [];
  for (let i = 0; i < arms * 2; i++) {
    const a = -Math.PI / 2 + (i / (arms * 2)) * Math.PI * 2 + (rand() - 0.5) * 0.2;
    const r = i % 2 === 0 ? 38 + rand() * 8 : 15 + rand() * 4;
    pts.push([60 + Math.cos(a) * r, 60 + Math.sin(a) * r]);
  }
  return {
    w: 120,
    h: 120,
    alt: 'Звёздочка',
    groups: [{ life: 'beat', origin: [60, 60], delay: -rand() * 3, paths: [{ d: wobble(pts, { seed: 172 + v, amp: 1, closed: true, overshoot: 0.05, jitter: 1.5 }) }] }],
  };
};

export const heart: IlloFactory = (v) => ({
  w: 120,
  h: 110,
  alt: 'Сердечко',
  groups: [
    {
      life: 'beat',
      origin: [60, 60],
      paths: [
        { d: scribble({ cx: 60, cy: 52, rx: 30, ry: 24, gap: 6, angle: -0.8, seed: 181 + v, amp: 1.2 }), tone: 'fill', fillOnly: true },
        { d: wobble([[60, 36], [72, 20], [94, 20], [104, 40], [92, 66], [62, 94], [34, 70], [16, 44], [24, 22], [46, 20]], { seed: 182 + v, amp: 1.3, closed: true, overshoot: 0.06 }) },
      ],
    },
  ],
});
