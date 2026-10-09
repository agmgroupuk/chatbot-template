import type { MetadataRoute } from 'next';
import { company } from '@/lib/company';
export default function sitemap():MetadataRoute.Sitemap { return ['','/about','/pricing','/contact','/support','/privacy','/terms','/payment-policy'].map(path=>({url:`${company.website}${path}`,changeFrequency:'monthly' as const,priority:path===''?1:0.6})); }
