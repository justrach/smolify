import { z } from "zod";

export const docsPageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/),
  title: z.string().min(1).max(120),
  description: z.string().max(240).default(""),
  markdown: z.string().min(1).max(250_000),
  sourceFiles: z.array(z.string().max(500)).max(100).default([]),
});

export const docsNavigationItemSchema = z.object({
  label: z.string().min(1).max(80),
  slug: z.string().min(1).max(160),
});

export const docsNavigationGroupSchema = z.object({
  label: z.string().min(1).max(80),
  items: z.array(docsNavigationItemSchema).min(1).max(100),
});

export const docsBundleSchema = z.object({
  schemaVersion: z.literal(1),
  project: z.object({
    name: z.string().min(1).max(80),
    description: z.string().max(240),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6d5efc"),
  }),
  generatedAt: z.string().datetime(),
  generator: z.object({
    name: z.literal("codex"),
    model: z.string().min(1).max(80),
  }),
  navigation: z.array(docsNavigationGroupSchema).min(1).max(30),
  pages: z.array(docsPageSchema).min(1).max(500),
});

export type DocsBundle = z.infer<typeof docsBundleSchema>;
export type DocsPage = z.infer<typeof docsPageSchema>;
