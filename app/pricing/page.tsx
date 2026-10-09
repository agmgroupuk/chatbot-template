import { createUpdateClient } from "@/utils/update/server";
import PricingContent from "@/components/pricing-content";
import { Product } from '@/types/products';

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
  if (!process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY) return <div className="m-auto p-6" role="alert">Billing is not configured. Please contact the site administrator.</div>;
  const client = await createUpdateClient();
  const { data, error } = await client.billing.getProducts();
  const { data: subscriptionData } = await client.billing.getSubscriptions();

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-red-600">
        There was an error loading products. Please try again.
      </div>
    );
  }

  const currentProductId = subscriptionData?.subscriptions?.find(sub => sub.status === 'active')?.product.id ?? null;
  if (!data.products.length) return <div className="m-auto p-6">No plans are currently available. Please check back later.</div>;

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-medium mb-4">Upgrade your plan</h1>
      </div>

      <PricingContent
        products={data.products as Product[]}
        currentProductId={currentProductId}
      />
    </div>
  );
} 