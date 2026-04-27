import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    readTime: z.string().optional(),
    draft: z.boolean().default(false)
  })
});

export const collections = { news };
