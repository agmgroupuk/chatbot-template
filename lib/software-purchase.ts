import { softwareCatalog } from '@/app/software/src/data/catalog';
import { STOREFRONT_TEMPLATES } from '@/app/software/src/data/templatesData';

export type SoftwarePurchaseKind = 'template' | 'software';

export interface SoftwarePurchaseItem {
  kind: SoftwarePurchaseKind;
  id: string;
  name: string;
  priceCents: number;
}

export function getSoftwarePurchaseItem(
  kind: string | undefined,
  id: string | undefined,
): SoftwarePurchaseItem | null {
  if (!id || (kind !== 'template' && kind !== 'software')) return null;

  if (kind === 'template') {
    const template = STOREFRONT_TEMPLATES.find((item) => item.id === id);
    return template ? {
      kind,
      id: template.id,
      name: template.name,
      priceCents: template.price * 100,
    } : null;
  }

  const product = softwareCatalog.find((item) => item.id === id);
  return product ? {
    kind,
    id: product.id,
    name: product.name,
    priceCents: product.priceUsd * 100,
  } : null;
}

export function parseSoftwarePaymentAmount(value: string, maximumCents: number): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const [dollars, cents = ''] = value.split('.');
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(amountCents) && amountCents >= 500 && amountCents <= maximumCents
    ? amountCents
    : null;
}
