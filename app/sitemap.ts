import type { MetadataRoute } from 'next';
import { siteUrl } from '@/config/site';

/**
 * Sitemap.
 *
 * Only the three public routes. /admin and /reservation/* are private and are
 * excluded here, in robots.txt, and by an X-Robots-Tag header — a page about
 * one customer's order has no business in a search index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/book`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/track`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
