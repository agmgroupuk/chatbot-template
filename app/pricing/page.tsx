import { createBillingClient } from "@/lib/billing";
import Link from "next/link";
import PricingContent from "@/components/pricing-content";
import { Product } from '@/types/products';
import { creditPlans } from '@/lib/credit-config';

// interface Price {
//   id: string;
//   unit_amount: number;
//   interval: 'month' | 'year';
// }
// 
// interface Product {
//   id: string;
//   name: string;
//   description: string;
//   prices: Price[];
// }

export default async function PricingPage() {
  const client = await createBillingClient();
  const { data, error } = await client.billing.getProducts();
  const { data: subscriptionData } = await client.billing.getSubscriptions();

  if (error) {
    return (
      <section className="m-auto max-w-lg p-6 text-stone-900"><h1 className="mb-4 text-3xl">Plans and credits</h1><p>Payments are temporarily unavailable. Please try again later.</p><Link href="/" className="mt-6 block underline">Return home</Link></section>
    );
  }

  const currentProductId = subscriptionData?.subscriptions?.find(sub => sub.status === 'active')?.product.id ?? null;
  if (!data.products?.length) return <div className="m-auto p-6">No plans are currently available. Please check back later.</div>;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-medium mb-4">Upgrade your plan</h1>
      </div>

      <PricingContent
        products={data.products as Product[]}
        currentProductId={currentProductId}
        currentPriceId={subscriptionData?.subscriptions?.find(sub => sub.status === 'active')?.price.id}
        supportsPlanChanges={process.env.BILLING_PROVIDER === 'stripe'}
        creditsByPrice={Object.fromEntries(Object.entries(creditPlans()).map(([id, plan]) => [id, plan.credits]))}
      />
    </div>
  );
}
