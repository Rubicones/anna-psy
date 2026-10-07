import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Content collections. Phase 1 defines FAQ (used by the styleguide accordion).
 * Facts, approaches, education and materials arrive with their sections.
 */
const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    order: z.number().default(100),
  }),
});

export const collections = { faq };
