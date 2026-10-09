"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/utils/styles";
import { useRouter } from "next/navigation";
import { createCheckout, getSubscriptionDetails, cancelSubscriptionAction, reactivateSubscriptionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Check, RefreshCcw, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Product, Price } from "@/types/products";

interface SubscriptionDetailsState {
  planName: string | null;
  subscriptionId: string | null;
  canUpgrade: boolean;
  renewalDate: string | null;
  isCancelled: boolean;
}

interface PricingContentProps {
  products: Product[];
  currentProductId: string | null;
}

export default function PricingContent({
  products,
  currentProductId,
}: PricingContentProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const router = useRouter();
  const [isLoadingPriceId, setIsLoadingPriceId] = useState<string | null>(null);

  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetailsState | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (currentProductId) {
        setIsLoadingDetails(true);
        setActionError(null);
        setActionSuccessMessage(null);
        try {
          const details = await getSubscriptionDetails();
          setSubscriptionDetails(details);
        } catch (error) {
          console.error("Error fetching subscription details:", error);
          setSubscriptionDetails(null);
        } finally {
          setIsLoadingDetails(false);
        }
      } else {
        setSubscriptionDetails(null);
      }
    }
    fetchData();
  }, [currentProductId]);

  async function handleSelectPlan(priceId: string) {
    setIsLoadingPriceId(priceId);
    setActionError(null);
    setActionSuccessMessage(null);
    try {
      await createCheckout(priceId);
    } catch (error) {
      console.error("Checkout error:", error);
      setActionError("Failed to initiate checkout. Please try again.");
      setIsLoadingPriceId(null);
    }
  }

  async function handleCancel() {
    if (!subscriptionDetails?.subscriptionId) return;
    setIsActionLoading(true);
    setActionError(null);
    setActionSuccessMessage(null);
    try {
      const result = await cancelSubscriptionAction(subscriptionDetails.subscriptionId);
      if (result.success) {
        const details = await getSubscriptionDetails();
        setSubscriptionDetails(details);
        setActionSuccessMessage("Subscription cancellation scheduled.");
      } else {
        setActionError(result.error || "Failed to cancel subscription.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      setActionError(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleReactivate() {
    if (!subscriptionDetails?.subscriptionId) return;
    setIsActionLoading(true);
    setActionError(null);
    setActionSuccessMessage(null);
    try {
      const result = await reactivateSubscriptionAction(subscriptionDetails.subscriptionId);
      if (result.success) {
        const details = await getSubscriptionDetails();
        setSubscriptionDetails(details);
        setActionSuccessMessage("Subscription reactivated successfully.");
      } else {
        setActionError(result.error || "Failed to reactivate subscription.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      setActionError(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  return (
    <div className="w-full bg-white text-stone-900">
      <button
        onClick={() => router.push('/')}
        className="fixed top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-center mb-6">
          <Tabs 
            value={billingInterval} 
            onValueChange={(value) => setBillingInterval(value as 'monthly' | 'yearly')} 
            className="w-[300px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mb-6 h-5 text-center">
          {actionSuccessMessage && (<p className="text-sm text-green-600"> {actionSuccessMessage}</p>)}
          {actionError && (<p className="text-sm text-red-600">Error: {actionError}</p>)}
        </div>

        <div className="flex flex-col items-center gap-8">
          <div className="flex justify-center mb-6">
            {products.map((product) => {
              const price = product.prices.find(
                (p: Price) => p.interval === (billingInterval === 'monthly' ? 'month' : 'year')
              );
              const isCurrent = currentProductId === product.id;
              const isLoadingThis = isLoadingPriceId === price?.id;
              const showManageButton = isCurrent && subscriptionDetails && !isLoadingDetails;

              return (
                <Card key={product.id} className={cn(
                  "relative overflow-hidden shadow-sm bg-white w-full max-w-[440px]",
                  isCurrent 
                    ? "ring-2 ring-blue-500" 
                    : "hover:shadow-lg"
                )}>
                  {isCurrent && (
                    <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 text-sm rounded-full">
                      Current Plan
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex flex-col space-y-5">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                          {product.description || "Get access to premium features and enhanced capabilities"}
                        </p>
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-gray-900">$</span>
                        <span className="text-5xl font-bold text-gray-900">
                          {((price?.unit_amount || 0) / 100).toFixed(2)}
                        </span>
                        <span className="text-gray-600 ml-1">
                          /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </div>

                      {isCurrent && subscriptionDetails && !isLoadingDetails && (
                        <div className="text-sm text-gray-500 pt-1 pb-3 text-center my-2 h-12 w-70 flex items-center justify-center">
                          {subscriptionDetails.isCancelled
                            ? `Plan cancelled. Access ends on ${subscriptionDetails.renewalDate || '[Date Unavailable]'}`
                            : `Plan auto-renews on ${subscriptionDetails.renewalDate || '[Date Unavailable]'}`}
                        </div>
                      )}
                      {isCurrent && isLoadingDetails && (
                        <div className="text-sm text-gray-400 pt-1 pb-3 text-center my-2 animate-pulse h-12 flex items-center justify-center">
                          Loading details...
                        </div>
                      )}

                      <div className="mt-auto min-h-10">
                        {showManageButton ? (
                          subscriptionDetails.isCancelled ? (
                            <Button
                              variant="outline"
                              className="w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                              onClick={handleReactivate}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? <Spinner className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCcw className="mr-2 h-5 w-5" aria-hidden="true" />}
                              Reactivate Subscription
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={handleCancel}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? <Spinner className="mr-2 h-5 w-5 animate-spin" /> : <XCircle className="mr-2 h-5 w-5" aria-hidden="true" />}
                              Cancel Subscription
                            </Button>
                          )
                        ) : (
                          <Button 
                            className={cn(
                              "w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors",
                              isCurrent 
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            )}
                            disabled={isCurrent || isLoadingThis || isLoadingDetails}
                            onClick={() => price && handleSelectPlan(price.id)}
                          >
                            {isLoadingThis ? (
                              <Spinner variant="primary" isLoading={true} />
                            ) : (
                              isCurrent ? 'Current Plan' : 'Select Plan'
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-3 pt-6 border-t border-gray-100 mt-6">
                        <p className="font-medium text-sm text-gray-900 mb-2">
                          {product.name === 'Free' ? 'Includes:' : `Everything in ${product.name === 'Pro' ? 'Basic' : 'Free'}, plus:`}
                        </p>
                        {(product.name === 'Basic' ? ['Enhanced chatbot capabilities', 'Faster response times', 'Email support'] : product.name === 'Pro' ? ['Advanced AI models', 'Priority access to new features', 'Dedicated support'] : ['Standard chatbot features', 'Basic response speed', 'Community forum access']).map((feature) => (
                          <div key={feature} className="flex items-center gap-3">
                            <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            <span className="text-gray-600 text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 text-center">
                        <span className="text-sm text-gray-500">
                          {billingInterval === 'yearly' ? 'Save 20% with annual billing' : 'Try free for 14 days'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
