# Anna — psychologist site ("naive art" edition)

Personal site for a practising psychologist (CBT & CFT). Astro, static output, TypeScript strict, almost no JS.
Visual idea: a soft, defocused colour field + one confident hand-drawn white line.

**Status:** phase 1 — art direction on [`/styleguide`](src/pages/styleguide.astro). The home page is a stub until phase 2.

## Run

```sh
npm install
npm run dev       # http://localhost:4321/styleguide
npm run check     # astro check (types)
npm run build     # static site in dist/
```

## Where things live

| What | Where |
| --- | --- |
| Names, booking link, socials, email | `src/site.config.ts` |
| Copy (one file per entry) | `src/content/<collection>/*.md` |
| Collection schemas | `src/content.config.ts` |
| Colours (CSS vars **and** shader palettes) | `src/lib/palette.ts` |
| Type scale, radii, grain, focus | `src/styles/global.css` |
| Hand-drawn line toolkit (build time) | `src/lib/wobble.ts` |
| Illustration library | `src/art/illustrations/*.ts`, registry in `src/art/index.ts` |
| SVG filters (boil, spray, rough edge, glass) | `src/components/art/ArtDefs.astro` |
| Living gradient field (WebGL) | `src/scripts/field.ts`, `src/components/art/GradientField.astro` |
| UI pieces | `src/components/ui/*` |

All placeholders are marked `TODO:` — search for it before launch.

## Editing copy

Each FAQ item is a Markdown file in `src/content/faq/`:

```md
---
question: Как проходит первая встреча?
order: 1
---

Ответ обычным текстом. Можно **жирный**, списки и ссылки.
```

Add a file → a new question appears. `order` sets the position. The same pattern will be used for facts, approaches, education and materials as their sections land (phase 3).

## Changing links

Edit `src/site.config.ts`: `bookingUrl`, `socials`, `email`, `name`, `role`, `description`.

## Downloadable materials (phase 3)

Files go into `public/materials/`. Each file will get one entry in `src/content/materials/` (title, description, format, size) — adding a file = adding one entry. The collection is defined together with the section.

## Colours

Edit hex values in `src/lib/palette.ts`. CSS variables (`--c-sun`, `--c-sun-rgb`, …) are generated from it, and the shader's time-of-day palettes (`daytimes`) live in the same file. The styleguide recomputes the WCAG contrast table on every build.

## Illustrations

Every drawing is a factory `(variant) => IlloDef`: a few rough control points per stroke, turned into a wobbly marker line by `wobble()` at build time. To add one:

1. Write a factory in `src/art/illustrations/*.ts` (copy a simple one, e.g. `heart`).
2. Register it in `src/art/index.ts`.
3. Use it: `<Illustration name="heart" size={120} tone="var(--c-coral)" draw />`.

Props: `tone` (line colour, white by default), `accent`, `fill` (scribble fill), `ink` (stroke px), `variant` (different hand), `boil`, `draw` (draw-on in view), `life` (idle animation), `label` (makes it meaningful for screen readers; otherwise decorative).

Idle animations are named in the factory (`life: 'sway' | 'tail' | 'dip' | 'hop' | …`) and defined in `Illustration.astro`.

## Time of day

Any element with `data-daytime="sea | meadow | sunset | dusk"` anchors a palette at its centre; the field blends between anchors while scrolling.

## Motion & accessibility

- `prefers-reduced-motion`: static shader frame, no boil, no draw-on, no idle life, no smooth scroll.
- Text always sits on paper / frosted panels in ink (AA). White is for line drawings only.
- No WebGL → CSS gradient fallback with the same palette.
