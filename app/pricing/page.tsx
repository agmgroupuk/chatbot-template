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

  const currentProductId =
    subscriptionData?.subscriptions == null ||
    subscriptionData?.subscriptions.length === 0
      ? null
      : subscriptionData.subscriptions[0].product.id;

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