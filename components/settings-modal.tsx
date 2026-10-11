'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X, CreditCard, Puzzle, UserRound, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getAccountDashboardDataAction,
  updateAccountPasswordAction,
  updateAccountProfileAction,
} from '@/app/account-actions';
import {
  cancelSubscriptionAction,
  updateUserModelSettings,
} from '@/app/actions';
import { PaymentMethodsPanel } from '@/components/payment-methods-panel';
import { availableModels } from '@/lib/models';

type DashboardData = Exclude<Awaited<ReturnType<typeof getAccountDashboardDataAction>>, { error: string }>;

export function SettingsModal({
  isOpen,
  setIsOpen,
  onSettingsChanged,
  initialTab = 'account',
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSettingsChanged?: () => void | Promise<void>;
  initialTab?: 'account' | 'modules' | 'subscriptions';
}) {
  const onClose = () => setIsOpen(false);
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingModules, setSavingModules] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [enabledModels, setEnabledModels] = useState<string[]>(availableModels.map((m) => m.id));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getAccountDashboardDataAction();
    if ('error' in result && result.error && !('profile' in result)) {
      setError(result.error);
      setData(null);
      setLoading(false);
      return;
    }
    const dashboard = result as DashboardData;
    setData(dashboard);
    setSameAsBilling(dashboard.profile.shippingSameAsBilling !== false);
    setEnabledModels(dashboard.modules.filter((m) => m.enabled).map((m) => m.id));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setMessage(null);
    void load();
  }, [isOpen, initialTab, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const profile = data?.profile;
  const subscription = data?.subscription as
    | {
        planName?: string | null;
        subscriptionId?: string | null;
        canUpgrade?: boolean;
        renewalDate?: string | null;
        isCancelled?: boolean;
        error?: string;
      }
    | null
    | undefined;

  async function onSaveProfile(formData: FormData) {
    setSavingProfile(true);
    setMessage(null);
    setError(null);
    formData.set('shippingSameAsBilling', sameAsBilling ? 'true' : 'false');
    const result = await updateAccountProfileAction(formData);
    if ('error' in result && result.error) setError(result.error);
    else {
      setMessage(result.message || 'Account details saved.');
      await onSettingsChanged?.();
    }
    await load();
    setSavingProfile(false);
  }

  async function onSavePassword(formData: FormData) {
    setSavingPassword(true);
    setMessage(null);
    setError(null);
    const result = await updateAccountPasswordAction(formData);
    if ('error' in result && result.error) setError(result.error);
    else setMessage(result.message || 'Password updated.');
    setSavingPassword(false);
  }

  async function onSaveModules() {
    setSavingModules(true);
    setMessage(null);
    setError(null);
    const result = await updateUserModelSettings(enabledModels);
    if (result && 'error' in result && result.error) setError(result.error);
    else {
      setMessage('Modules updated.');
      await onSettingsChanged?.();
      await load();
    }
    setSavingModules(false);
  }

  async function onCancelSubscription() {
    if (!subscription?.subscriptionId) return;
    setCanceling(true);
    setMessage(null);
    setError(null);
    const result = await cancelSubscriptionAction(subscription.subscriptionId);
    if (!result.success) setError(result.error || 'Unable to cancel subscription.');
    else {
      setMessage('Cancellation scheduled for the end of the current period.');
      await onSettingsChanged?.();
      await load();
    }
    setCanceling(false);
  }

  return (
    <div className="settings-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="settings-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Account settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-modal-header">
          <div>
            <p className="settings-kicker">User dashboard</p>
            <h2>Settings</h2>
            <p className="muted text-sm">
              Manage personal account details, modules, subscriptions, and payment methods here. Workspace setup stays on{' '}
              <Link href="/account" className="text-link" onClick={onClose}>
                /account
              </Link>
              .
            </p>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? <p className="settings-banner settings-banner-error">{error}</p> : null}
        {message ? <p className="settings-banner settings-banner-ok">{message}</p> : null}
        {loading && !data ? <p className="muted px-1 py-2 text-sm">Loading your dashboard…</p> : null}

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="settings-tabs">
          <TabsList className="settings-tablist">
            <TabsTrigger value="account" className="settings-tab">
              <UserRound className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="modules" className="settings-tab">
              <Puzzle className="h-4 w-4" />
              Modules
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="settings-tab">
              <CreditCard className="h-4 w-4" />
              Subscriptions
            </TabsTrigger>
          </TabsList>

          <div className="settings-tab-body">
            <TabsContent value="account" className="settings-tab-content">
              <section className="settings-section">
                <div className="settings-section-head">
                  <h3>Profile</h3>
                  <p className="muted text-sm">Personal details used across One Fin account screens.</p>
                </div>
                <form action={onSaveProfile} className="settings-form-grid">
                  <label className="field">
                    <span>Full name</span>
                    <input name="fullName" defaultValue={profile?.fullName || profile?.name || ''} placeholder="Your full name" />
                  </label>
                  <label className="field">
                    <span>Email address</span>
                    <input value={profile?.email || ''} readOnly disabled placeholder="you@example.com" />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input name="phone" defaultValue={profile?.phone || ''} placeholder="+1 555 000 0000" />
                  </label>
                  <label className="field">
                    <span>Company</span>
                    <input name="companyName" defaultValue={profile?.companyName || ''} placeholder="Company or team name" />
                  </label>

                  <div className="settings-subsection">
                    <h4>Billing details</h4>
                    <div className="settings-form-grid">
                      <label className="field">
                        <span>Billing name</span>
                        <input name="billingName" defaultValue={profile?.billingName || ''} placeholder="Name on invoices" />
                      </label>
                      <label className="field">
                        <span>Billing address line 1</span>
                        <input name="billingLine1" defaultValue={profile?.billingLine1 || ''} placeholder="Street address" />
                      </label>
                      <label className="field">
                        <span>Billing address line 2</span>
                        <input name="billingLine2" defaultValue={profile?.billingLine2 || ''} placeholder="Apt, suite, etc." />
                      </label>
                      <label className="field">
                        <span>City</span>
                        <input name="billingCity" defaultValue={profile?.billingCity || ''} placeholder="City" />
                      </label>
                      <label className="field">
                        <span>State / region</span>
                        <input name="billingState" defaultValue={profile?.billingState || ''} placeholder="State" />
                      </label>
                      <label className="field">
                        <span>Postal code</span>
                        <input name="billingPostal" defaultValue={profile?.billingPostal || ''} placeholder="Postal code" />
                      </label>
                      <label className="field">
                        <span>Country</span>
                        <input name="billingCountry" defaultValue={profile?.billingCountry || ''} placeholder="Country" />
                      </label>
                    </div>
                  </div>

                  <div className="settings-subsection">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4>Shipping address</h4>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={sameAsBilling}
                          onChange={(event) => setSameAsBilling(event.target.checked)}
                        />
                        Same as billing
                      </label>
                    </div>
                    {!sameAsBilling ? (
                      <div className="settings-form-grid">
                        <label className="field">
                          <span>Shipping name</span>
                          <input name="shippingName" defaultValue={profile?.shippingName || ''} placeholder="Recipient name" />
                        </label>
                        <label className="field">
                          <span>Shipping address line 1</span>
                          <input name="shippingLine1" defaultValue={profile?.shippingLine1 || ''} placeholder="Street address" />
                        </label>
                        <label className="field">
                          <span>Shipping address line 2</span>
                          <input name="shippingLine2" defaultValue={profile?.shippingLine2 || ''} placeholder="Apt, suite, etc." />
                        </label>
                        <label className="field">
                          <span>City</span>
                          <input name="shippingCity" defaultValue={profile?.shippingCity || ''} placeholder="City" />
                        </label>
                        <label className="field">
                          <span>State / region</span>
                          <input name="shippingState" defaultValue={profile?.shippingState || ''} placeholder="State" />
                        </label>
                        <label className="field">
                          <span>Postal code</span>
                          <input name="shippingPostal" defaultValue={profile?.shippingPostal || ''} placeholder="Postal code" />
                        </label>
                        <label className="field">
                          <span>Country</span>
                          <input name="shippingCountry" defaultValue={profile?.shippingCountry || ''} placeholder="Country" />
                        </label>
                      </div>
                    ) : (
                      <p className="muted text-sm">Shipping copies your billing address until you turn this off.</p>
                    )}
                  </div>

                  <div className="button-row">
                    <Button type="submit" disabled={savingProfile}>
                      {savingProfile ? 'Saving…' : 'Save account details'}
                    </Button>
                  </div>
                </form>
              </section>

              <section className="settings-section">
                <div className="settings-section-head">
                  <h3 className="inline-flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Password & security
                  </h3>
                  <p className="muted text-sm">Change your password. Other sessions are signed out after a successful update.</p>
                </div>
                <form action={onSavePassword} className="settings-form-grid">
                  <label className="field">
                    <span>Current password</span>
                    <input name="currentPassword" type="password" autoComplete="current-password" required placeholder="Current password" />
                  </label>
                  <label className="field">
                    <span>New password</span>
                    <input name="nextPassword" type="password" autoComplete="new-password" required minLength={12} placeholder="At least 12 characters" />
                  </label>
                  <label className="field">
                    <span>Confirm new password</span>
                    <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} placeholder="Repeat new password" />
                  </label>
                  <div className="button-row">
                    <Button type="submit" variant="outline" disabled={savingPassword}>
                      {savingPassword ? 'Updating…' : 'Update password'}
                    </Button>
                  </div>
                </form>
              </section>

              <section className="settings-section">
                <PaymentMethodsPanel compact />
              </section>
            </TabsContent>

            <TabsContent value="modules" className="settings-tab-content">
              <section className="settings-section">
                <div className="settings-section-head">
                  <h3>Modules</h3>
                  <p className="muted text-sm">
                    Enable chat models available in your experience. Disabled modules stay hidden from selectors.
                  </p>
                </div>
                <ul className="settings-module-list">
                  {(data?.modules || availableModels.map((m) => ({ id: m.id, name: m.name, description: '', enabled: true }))).map(
                    (module) => {
                      const checked = enabledModels.includes(module.id);
                      return (
                        <li key={module.id} className="settings-module-item">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={(event) => {
                                setEnabledModels((current) => {
                                  if (event.target.checked) return Array.from(new Set([...current, module.id]));
                                  if (current.length <= 1) return current;
                                  return current.filter((id) => id !== module.id);
                                });
                              }}
                            />
                            <span>
                              <span className="block font-medium text-slate-900">{module.name}</span>
                              <span className="muted block text-sm">{module.description || module.id}</span>
                              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                {checked ? 'Enabled' : 'Disabled'}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    },
                  )}
                </ul>
                <div className="button-row mt-4">
                  <Button type="button" onClick={() => void onSaveModules()} disabled={savingModules || enabledModels.length === 0}>
                    {savingModules ? 'Saving…' : 'Save modules'}
                  </Button>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="subscriptions" className="settings-tab-content">
              <section className="settings-section">
                <div className="settings-section-head">
                  <h3>Homepage chat subscription</h3>
                  <p className="muted text-sm">Current plan, renewal status, and billing shortcuts.</p>
                </div>

                {subscription?.subscriptionId ? (
                  <div className="settings-plan-card">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">Current plan</p>
                      <h4 className="text-xl font-semibold text-slate-900">{subscription.planName || 'Active plan'}</h4>
                      <p className="muted text-sm">
                        {subscription.isCancelled ? 'Cancels at period end' : 'Active subscription'}
                      </p>
                      {subscription.renewalDate ? (
                        <p className="muted text-sm">
                          {subscription.isCancelled ? 'Ends' : 'Renews'} {subscription.renewalDate}
                        </p>
                      ) : null}
                    </div>
                    <div className="button-row">
                      <Link className="button secondary" href="/dashboard/billing" onClick={onClose}>
                        Plans & billing
                      </Link>
                      <Link className="button secondary" href="/pricing" onClick={onClose}>
                        Change plan
                      </Link>
                      {!subscription.isCancelled ? (
                        <Button type="button" variant="outline" disabled={canceling} onClick={() => void onCancelSubscription()}>
                          {canceling ? 'Canceling…' : 'Cancel at period end'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="settings-plan-card">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">No active homepage plan</h4>
                      <p className="muted text-sm">
                        Choose a Monthly or Yearly plan for unlimited homepage chat. Workspace credits are managed separately.
                      </p>
                      {subscription?.error ? <p className="text-sm text-amber-700">{subscription.error}</p> : null}
                    </div>
                    <div className="button-row">
                      <Link className="button" href="/pricing" onClick={onClose}>
                        View plans
                      </Link>
                      <Link className="button secondary" href="/dashboard/billing" onClick={onClose}>
                        Open billing
                      </Link>
                    </div>
                  </div>
                )}
              </section>

              <section className="settings-section">
                <PaymentMethodsPanel />
              </section>

              {data?.workspace ? (
                <section className="settings-section">
                  <div className="settings-section-head">
                    <h3>Workspace credits snapshot</h3>
                    <p className="muted text-sm">Full Workspace setup stays on the dedicated account page.</p>
                  </div>
                  <div className="settings-plan-card">
                    <div>
                      <p className="text-sm text-slate-700">
                        Balance: <strong>{data.workspace.balance}</strong> credits
                      </p>
                      <p className="muted text-sm">
                        {data.workspace.cardLast4
                          ? `Workspace card on file: ${(data.workspace.cardBrand || 'card').toString()} ···· ${data.workspace.cardLast4}`
                          : 'No dedicated Workspace card saved yet.'}
                      </p>
                    </div>
                    <Link className="button secondary" href="/account" onClick={onClose}>
                      Manage Workspace
                    </Link>
                  </div>
                </section>
              ) : null}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
