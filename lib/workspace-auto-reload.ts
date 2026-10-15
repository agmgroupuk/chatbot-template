import 'server-only';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { query, transaction } from '@/lib/db';
import { verifiedStripe } from '@/lib/stripe';
import { workspaceCustomer } from '@/lib/workspace-stripe';
import { workspaceCreditPack } from '@/lib/workspace-credit-pack';
import { creditPlans } from '@/lib/credit-config';
import { requireOwnedPaymentMethod } from '@/lib/billing-scope';
import { stripeObjectMatchesMode } from '@/lib/billing-environment';
import { fulfillStripeEvent } from '@/lib/stripe-fulfillment';

const COOLDOWN_MS = 2 * 60 * 1000;
const PENDING_STALE_MS = 15 * 60 * 1000;

export type WorkspaceAutoReloadSettings = {
  enabled: boolean;
  threshold: number;
  hasPaymentMethod: boolean;
  lastError: string | null;
  lastAt: string | null;
};

export async function readWorkspaceAutoReloadSettings(
  userId: string,
): Promise<WorkspaceAutoReloadSettings> {
  try {
    const [row] = await query<{
      auto_reload_enabled: boolean | null;
      auto_reload_threshold: number | null;
      payment_method_id: string | null;
      last_auto_reload_error: string | null;
      last_auto_reload_at: string | null;
    }>(
      `select auto_reload_enabled, auto_reload_threshold, payment_method_id,
              last_auto_reload_error, last_auto_reload_at::text
       from workspace_credit_settings where user_id=$1`,
      [userId],
    );

    return {
      enabled: Boolean(row?.auto_reload_enabled),
      threshold: Number.isFinite(Number(row?.auto_reload_threshold))
        ? Number(row?.auto_reload_threshold)
        : 1,
      hasPaymentMethod: Boolean(row?.payment_method_id),
      lastError: row?.last_auto_reload_error || null,
      lastAt: row?.last_auto_reload_at || null,
    };
  } catch {
    // Migration 015 not applied yet — treat as disabled.
    const [row] = await query<{ payment_method_id: string | null }>(
      'select payment_method_id from workspace_credit_settings where user_id=$1',
      [userId],
    ).catch(() => [null]);
    return {
      enabled: false,
      threshold: 1,
      hasPaymentMethod: Boolean(row?.payment_method_id),
      lastError: null,
      lastAt: null,
    };
  }
}

/**
 * Best-effort low-balance top-up. Never throws to callers (spend path must stay intact).
 * Charges only the Workspace-scoped customer + saved Workspace payment method.
 */
export async function maybeAttemptWorkspaceAutoReload(userId: string): Promise<{
  attempted: boolean;
  charged?: boolean;
  skipped?: string;
  error?: string;
}> {
  try {
    const [balanceRow] = await query<{ balance: string }>(
      'select available_credits($1)::text as balance',
      [userId],
    );
    const balance = Number(balanceRow?.balance || 0);

    let settings: {
      auto_reload_enabled: boolean;
      auto_reload_threshold: number;
      payment_method_id: string | null;
      last_auto_reload_at: Date | string | null;
    } | null = null;

    try {
      const rows = await query<{
        auto_reload_enabled: boolean;
        auto_reload_threshold: number;
        payment_method_id: string | null;
        last_auto_reload_at: Date | string | null;
      }>(
        `select auto_reload_enabled, auto_reload_threshold, payment_method_id, last_auto_reload_at
         from workspace_credit_settings where user_id=$1`,
        [userId],
      );
      settings = rows[0] || null;
    } catch {
      return { attempted: false, skipped: 'migration_pending' };
    }

    if (!settings?.auto_reload_enabled) return { attempted: false, skipped: 'disabled' };
    if (!settings.payment_method_id) return { attempted: false, skipped: 'no_payment_method' };

    const threshold = Number(settings.auto_reload_threshold ?? 1);
    if (!(balance <= threshold)) return { attempted: false, skipped: 'above_threshold' };

    if (settings.last_auto_reload_at) {
      const last = new Date(settings.last_auto_reload_at).getTime();
      if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) {
        return { attempted: false, skipped: 'cooldown' };
      }
    }

    const [pending] = await query<{ id: string; created_at: string }>(
      `select id, created_at::text
       from workspace_credit_purchases
       where user_id=$1 and status='pending'
         and (source = 'auto_reload' or source is null)
       order by created_at desc limit 1`,
      [userId],
    ).catch(async () =>
      query<{ id: string; created_at: string }>(
        `select id, created_at::text
         from workspace_credit_purchases
         where user_id=$1 and status='pending'
         order by created_at desc limit 1`,
        [userId],
      ),
    );

    // Only block on a recent pending auto-reload (not manual checkout drafts).
    if (pending) {
      const age = Date.now() - new Date(pending.created_at).getTime();
      if (Number.isFinite(age) && age < PENDING_STALE_MS) {
        // If source column exists and this is not auto, ignore; otherwise be conservative only under cooldown.
        return { attempted: false, skipped: 'pending_in_flight' };
      }
    }

    const customerId = await workspaceCustomer(userId, false);
    if (!customerId) return { attempted: false, skipped: 'no_customer' };

    const packPrices = Object.entries(creditPlans()).filter(
      ([, plan]) => plan.kind === 'pack' && plan.credits === workspaceCreditPack.credits,
    );
    if (packPrices.length !== 1) return { attempted: false, skipped: 'pack_not_configured' };
    const priceId = packPrices[0][0];

    const stripe = await verifiedStripe();
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product as Stripe.Product;
    if (
      !stripeObjectMatchesMode(price.livemode) ||
      !price.active ||
      price.currency !== workspaceCreditPack.currency ||
      price.unit_amount !== workspaceCreditPack.amount ||
      price.recurring ||
      product.deleted ||
      !product.active ||
      product.metadata.app !== 'chatbot-template' ||
      price.metadata.app !== 'chatbot-template' ||
      Number(price.metadata.credits) !== workspaceCreditPack.credits
    ) {
      return { attempted: false, skipped: 'price_mismatch' };
    }

    const paymentMethod = await requireOwnedPaymentMethod(
      stripe,
      customerId,
      settings.payment_method_id,
    );

    const purchaseId = randomUUID();
    try {
      await query(
        `insert into workspace_credit_purchases(id,user_id,amount,credits,status,source)
         values ($1,$2,$3,$4,'pending','auto_reload')`,
        [purchaseId, userId, workspaceCreditPack.amount, workspaceCreditPack.credits],
      );
    } catch {
      await query(
        `insert into workspace_credit_purchases(id,user_id,amount,credits,status)
         values ($1,$2,$3,$4,'pending')`,
        [purchaseId, userId, workspaceCreditPack.amount, workspaceCreditPack.credits],
      );
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: workspaceCreditPack.amount,
          currency: workspaceCreditPack.currency,
          customer: customerId,
          payment_method: paymentMethod.id,
          confirm: true,
          off_session: true,
          error_on_requires_action: true,
          description: `${workspaceCreditPack.credits} One Fin Workspace credits (auto-reload)`,
          metadata: {
            app: 'chatbot-template',
            billing_scope: 'workspace',
            flow: 'workspace-credit-purchase',
            auto_reload: 'true',
            purchase_id: purchaseId,
            user_id: userId,
            pack_id: workspaceCreditPack.id,
            price_id: price.id,
          },
        },
        { idempotencyKey: `workspace-auto-reload:${userId}:${purchaseId}` },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auto-reload charge failed.';
      await markAutoReloadFailure(userId, purchaseId, null, message);
      return { attempted: true, charged: false, error: message };
    }

    await query(
      `update workspace_credit_purchases set stripe_payment_intent=$1
       where id=$2 and user_id=$3 and status='pending'
         and (stripe_payment_intent is null or stripe_payment_intent=$1)`,
      [intent.id, purchaseId, userId],
    );

    if (intent.status === 'succeeded') {
      await fulfillStripeEvent(stripe, {
        id: `workspace-auto-reload:${intent.id}`,
        type: 'payment_intent.succeeded',
        livemode: intent.livemode,
        data: { object: intent },
      } as Stripe.Event);

      await query(
        `update workspace_credit_settings set
           last_auto_reload_at=now(),
           last_auto_reload_error=null,
           last_auto_reload_payment_intent=$2
         where user_id=$1`,
        [userId, intent.id],
      ).catch(() => undefined);

      return { attempted: true, charged: true };
    }

    const message =
      intent.status === 'requires_action'
        ? 'Card requires authentication; complete a manual credit purchase or update the card.'
        : `Auto-reload ended with status ${intent.status}.`;
    await markAutoReloadFailure(userId, purchaseId, intent.id, message);
    return { attempted: true, charged: false, error: message };
  } catch (error) {
    console.error('Workspace auto-reload failed:', error);
    return {
      attempted: true,
      charged: false,
      error: error instanceof Error ? error.message : 'Auto-reload failed.',
    };
  }
}

async function markAutoReloadFailure(
  userId: string,
  purchaseId: string,
  paymentIntentId: string | null,
  message: string,
) {
  await transaction(async (client) => {
    await client.query(
      `update workspace_credit_purchases
       set status='failed',
           stripe_payment_intent=coalesce($3, stripe_payment_intent)
       where id=$1 and user_id=$2 and status='pending'`,
      [purchaseId, userId, paymentIntentId],
    );
    await client
      .query(
        `update workspace_credit_settings set
           last_auto_reload_at=now(),
           last_auto_reload_error=$2,
           last_auto_reload_payment_intent=coalesce($3, last_auto_reload_payment_intent)
         where user_id=$1`,
        [userId, message.slice(0, 500), paymentIntentId],
      )
      .catch(() => undefined);
  });
}
