import type { LucideIcon } from 'lucide-react';
import { BriefcaseBusiness, Code2, MonitorSmartphone } from 'lucide-react';

export interface SoftwareProduct {
  id: 'agency' | 'admin' | 'commerce' | 'landing' | 'mobile' | 'crm';
  name: string;
  category: string;
  description: string;
  priceLabel: string;
}

export const softwareCatalog: SoftwareProduct[] = [
  { id: 'agency', name: 'Agency Website Kit', category: 'Business website', description: 'A polished starting point for creative studios and service agencies.', priceLabel: '฿2,490' },
  { id: 'admin', name: 'SaaS Admin Dashboard', category: 'SaaS dashboard', description: 'A clear interface for managing users, metrics, and product settings.', priceLabel: '฿3,490' },
  { id: 'commerce', name: 'E-commerce Storefront', category: 'Online store', description: 'A product-first storefront concept for presenting your collection.', priceLabel: '฿2,990' },
  { id: 'landing', name: 'SaaS Landing Page', category: 'Landing page', description: 'A focused layout for introducing and explaining a digital product.', priceLabel: '฿1,790' },
  { id: 'mobile', name: 'Mobile App UI Starter', category: 'Mobile UI', description: 'A flexible visual foundation for a new mobile application.', priceLabel: '฿2,490' },
  { id: 'crm', name: 'CRM & Sales Dashboard', category: 'CRM dashboard', description: 'A practical concept for contacts, sales pipeline, and activity.', priceLabel: '฿3,990' },
];

export const softwareServices: Array<{
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  Icon: LucideIcon;
}> = [
  { id: 'website', name: 'Business Website Development', description: 'A tailored responsive website designed around your services and goals.', priceLabel: 'Starting from ฿18,000', Icon: BriefcaseBusiness },
  { id: 'dashboard', name: 'Dashboard & Business Software', description: 'Purpose-built interfaces and workflows for your team and operations.', priceLabel: 'Starting from ฿35,000', Icon: Code2 },
  { id: 'mobile', name: 'Mobile Application Development', description: 'A custom mobile product experience, from interface through development.', priceLabel: 'Starting from ฿60,000', Icon: MonitorSmartphone },
];
