import { query } from './db';
import { defaultPreferences, type AccountPreferences } from './account-preferences';

export type AccountProfile = {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  phone: string | null;
  companyName: string | null;
  billingName: string | null;
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostal: string | null;
  billingCountry: string | null;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostal: string | null;
  shippingCountry: string | null;
  shippingSameAsBilling: boolean;
  emailVerifiedAt: string | null;
  createdAt: string | null;
};

function mapProfile(row: Record<string, unknown> | undefined | null): AccountProfile | null {
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email || ''),
    name: (row.name as string | null) ?? null,
    fullName: (row.full_name as string | null) ?? (row.name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    billingName: (row.billing_name as string | null) ?? null,
    billingLine1: (row.billing_line1 as string | null) ?? null,
    billingLine2: (row.billing_line2 as string | null) ?? null,
    billingCity: (row.billing_city as string | null) ?? null,
    billingState: (row.billing_state as string | null) ?? null,
    billingPostal: (row.billing_postal as string | null) ?? null,
    billingCountry: (row.billing_country as string | null) ?? null,
    shippingName: (row.shipping_name as string | null) ?? null,
    shippingLine1: (row.shipping_line1 as string | null) ?? null,
    shippingLine2: (row.shipping_line2 as string | null) ?? null,
    shippingCity: (row.shipping_city as string | null) ?? null,
    shippingState: (row.shipping_state as string | null) ?? null,
    shippingPostal: (row.shipping_postal as string | null) ?? null,
    shippingCountry: (row.shipping_country as string | null) ?? null,
    shippingSameAsBilling: row.shipping_same_as_billing !== false,
    emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

export async function readProfile(userId: string): Promise<AccountProfile | null> {
  try {
    const rows = await query<Record<string, unknown>>(
      `select id, email, name, full_name, phone, company_name,
              billing_name, billing_line1, billing_line2, billing_city, billing_state, billing_postal, billing_country,
              shipping_name, shipping_line1, shipping_line2, shipping_city, shipping_state, shipping_postal, shipping_country,
              shipping_same_as_billing, email_verified_at::text, created_at::text
       from app_users where id=$1 limit 1`,
      [userId],
    );
    return mapProfile(rows[0]);
  } catch {
    const rows = await query<Record<string, unknown>>(
      `select id, email, name, email_verified_at::text, created_at::text from app_users where id=$1 limit 1`,
      [userId],
    );
    return mapProfile(rows[0]);
  }
}

export async function updateProfileDetails(
  userId: string,
  input: {
    fullName?: string | null;
    phone?: string | null;
    companyName?: string | null;
    billingName?: string | null;
    billingLine1?: string | null;
    billingLine2?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingPostal?: string | null;
    billingCountry?: string | null;
    shippingName?: string | null;
    shippingLine1?: string | null;
    shippingLine2?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPostal?: string | null;
    shippingCountry?: string | null;
    shippingSameAsBilling?: boolean;
  },
) {
  const fullName = (input.fullName ?? '').trim() || null;
  const phone = (input.phone ?? '').trim() || null;
  const companyName = (input.companyName ?? '').trim() || null;
  const same = Boolean(input.shippingSameAsBilling);

  const billing = {
    name: (input.billingName ?? '').trim() || null,
    line1: (input.billingLine1 ?? '').trim() || null,
    line2: (input.billingLine2 ?? '').trim() || null,
    city: (input.billingCity ?? '').trim() || null,
    state: (input.billingState ?? '').trim() || null,
    postal: (input.billingPostal ?? '').trim() || null,
    country: (input.billingCountry ?? '').trim() || null,
  };

  const shipping = same
    ? billing
    : {
        name: (input.shippingName ?? '').trim() || null,
        line1: (input.shippingLine1 ?? '').trim() || null,
        line2: (input.shippingLine2 ?? '').trim() || null,
        city: (input.shippingCity ?? '').trim() || null,
        state: (input.shippingState ?? '').trim() || null,
        postal: (input.shippingPostal ?? '').trim() || null,
        country: (input.shippingCountry ?? '').trim() || null,
      };

  await query(
    `update app_users set
       name=coalesce($2, name),
       full_name=$2,
       phone=$3,
       company_name=$4,
       billing_name=$5, billing_line1=$6, billing_line2=$7, billing_city=$8, billing_state=$9, billing_postal=$10, billing_country=$11,
       shipping_name=$12, shipping_line1=$13, shipping_line2=$14, shipping_city=$15, shipping_state=$16, shipping_postal=$17, shipping_country=$18,
       shipping_same_as_billing=$19,
       updated_at=now()
     where id=$1`,
    [
      userId,
      fullName,
      phone,
      companyName,
      billing.name,
      billing.line1,
      billing.line2,
      billing.city,
      billing.state,
      billing.postal,
      billing.country,
      shipping.name,
      shipping.line1,
      shipping.line2,
      shipping.city,
      shipping.state,
      shipping.postal,
      shipping.country,
      same,
    ],
  );
}

export async function readPreferences(userId: string) {
  const rows = await query<{ preferences: AccountPreferences | null }>(
    'select preferences from account_preferences where user_id=$1',
    [userId],
  );
  return { ...defaultPreferences, ...(rows[0]?.preferences || {}) } as AccountPreferences;
}

export async function writePreferences(userId: string, preferences: AccountPreferences) {
  await query(
    `insert into account_preferences(user_id,preferences,updated_at)
     values ($1,$2::jsonb,now())
     on conflict (user_id) do update set preferences=excluded.preferences, updated_at=now()`,
    [userId, JSON.stringify(preferences)],
  );
}
