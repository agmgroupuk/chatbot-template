'use server';

import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/session';
import { readPreferences, readProfile, updateProfileDetails, writePreferences } from '@/lib/account-service';
import {
  defaultPreferences,
  parsePreferences,
  type AccountPreferences,
} from '@/lib/account-preferences';
import { changePassword, throttle } from '@/lib/auth-service';
import { query } from '@/lib/db';
import { listPaymentMethodsAction } from '@/app/payment-method-actions';
import { availableModels } from '@/lib/models';
import {
  getSubscriptionDetails,
  getUserModelSettings,
} from '@/app/actions';

function clean(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function getAccountDashboardDataAction() {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in.' } as const;

  const [profile, preferences, paymentMethods, modelSettings, subscription] = await Promise.all([
    readProfile(user.id),
    readPreferences(user.id),
    listPaymentMethodsAction().catch(() => ({ error: 'Unable to load payment methods.' as const })),
    getUserModelSettings().catch(() => ({ enabledModels: availableModels.map((m) => m.id) })),
    getSubscriptionDetails().catch(() => null),
  ]);

  let workspace: {
    balance: string;
    cardBrand: string | null;
    cardLast4: string | null;
  } | null = null;
  try {
    const balanceRows = await query<{ balance: string }>('select available_credits($1)::text as balance', [user.id]);
    const cardRows = await query<{ card_brand: string | null; card_last4: string | null }>(
      'select card_brand, card_last4 from workspace_credit_settings where user_id=$1 limit 1',
      [user.id],
    );
    workspace = {
      balance: balanceRows[0]?.balance || '0',
      cardBrand: cardRows[0]?.card_brand || null,
      cardLast4: cardRows[0]?.card_last4 || null,
    };
  } catch {
    workspace = null;
  }

  const enabledModels =
    modelSettings && 'enabledModels' in modelSettings && Array.isArray(modelSettings.enabledModels)
      ? (modelSettings.enabledModels as string[])
      : availableModels.map((m) => m.id);

  return {
    profile:
      profile || {
        id: user.id,
        email: user.email,
        name: null,
        fullName: null,
        phone: null,
        companyName: null,
        billingName: null,
        billingLine1: null,
        billingLine2: null,
        billingCity: null,
        billingState: null,
        billingPostal: null,
        billingCountry: null,
        shippingName: null,
        shippingLine1: null,
        shippingLine2: null,
        shippingCity: null,
        shippingState: null,
        shippingPostal: null,
        shippingCountry: null,
        shippingSameAsBilling: true,
        emailVerifiedAt: user.email_verified_at,
        createdAt: null,
      },
    preferences,
    subscription,
    paymentMethods: 'error' in paymentMethods ? { error: paymentMethods.error } : paymentMethods,
    modules: availableModels.map((model) => ({
      id: model.id,
      name: model.name,
      description: 'Chat model available in One Fin.',
      enabled: enabledModels.includes(model.id),
    })),
    workspace,
  } as const;
}

export async function updateAccountProfileAction(formData: FormData) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in.' } as const;
  try {
    await throttle(`profile:${user.id}`, 20);
    await updateProfileDetails(user.id, {
      fullName: clean(formData.get('fullName')) || null,
      phone: clean(formData.get('phone')) || null,
      companyName: clean(formData.get('companyName')) || null,
      billingName: clean(formData.get('billingName')) || null,
      billingLine1: clean(formData.get('billingLine1')) || null,
      billingLine2: clean(formData.get('billingLine2')) || null,
      billingCity: clean(formData.get('billingCity')) || null,
      billingState: clean(formData.get('billingState')) || null,
      billingPostal: clean(formData.get('billingPostal')) || null,
      billingCountry: clean(formData.get('billingCountry')) || null,
      shippingName: clean(formData.get('shippingName')) || null,
      shippingLine1: clean(formData.get('shippingLine1')) || null,
      shippingLine2: clean(formData.get('shippingLine2')) || null,
      shippingCity: clean(formData.get('shippingCity')) || null,
      shippingState: clean(formData.get('shippingState')) || null,
      shippingPostal: clean(formData.get('shippingPostal')) || null,
      shippingCountry: clean(formData.get('shippingCountry')) || null,
      shippingSameAsBilling:
        formData.get('shippingSameAsBilling') === 'on' || formData.get('shippingSameAsBilling') === 'true',
    });
    revalidatePath('/');
    revalidatePath('/account');
    revalidatePath('/dashboard');
    return { success: true as const, message: 'Account details saved.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to save account details right now.',
    } as const;
  }
}

export async function updateAccountPasswordAction(formData: FormData) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in.' } as const;
  const currentPassword = clean(formData.get('currentPassword'));
  const nextPassword = clean(formData.get('nextPassword'));
  const confirmPassword = clean(formData.get('confirmPassword'));
  if (!currentPassword || !nextPassword) return { error: 'Enter your current and new password.' } as const;
  if (nextPassword !== confirmPassword) return { error: 'New password confirmation does not match.' } as const;
  try {
    await throttle(`password:${user.id}`, 8);
    await changePassword(user.id, currentPassword, nextPassword);
    return { success: true as const, message: 'Password updated. Sign in again with your new password.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to update password right now.',
    } as const;
  }
}

export async function savePreferencesAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  try {
    const next = parsePreferences(formData);
    await writePreferences(user.id, next);
    revalidatePath('/account');
    revalidatePath('/account/preferences');
  } catch {
    /* form validation errors surface via revalidation/empty state */
  }
}

export async function saveWorkspacePreferencesAction(formData: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  try {
    await throttle(`workspace-prefs:${user.id}`, 20);
    const current = await readPreferences(user.id);
    const next: AccountPreferences = {
      ...defaultPreferences,
      ...current,
      theme: clean(formData.get('theme')) || current.theme || defaultPreferences.theme,
      timezone: clean(formData.get('timezone')) || current.timezone || defaultPreferences.timezone,
      enter_to_send: formData.has('enter_to_send') ? formData.get('enter_to_send') === 'on' : current.enter_to_send,
      spellcheck: formData.has('spellcheck') ? formData.get('spellcheck') === 'on' : current.spellcheck,
      context_enabled: formData.has('context_enabled')
        ? formData.get('context_enabled') === 'on'
        : current.context_enabled,
      product_updates: formData.has('product_updates')
        ? formData.get('product_updates') === 'on'
        : current.product_updates,
    };
    await writePreferences(user.id, next);
    revalidatePath('/account');
    revalidatePath('/workspace');
  } catch {
    /* keep page usable if prefs write fails */
  }
}
