'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { X, Check, ArrowUpCircle, XCircle, LayoutGrid, RefreshCcw, User, CreditCard, List } from 'lucide-react';
import { createSupabaseClient } from '@/utils/supabase/client';
import { 
  getSubscriptionDetails, 
  cancelSubscriptionAction, 
  reactivateSubscriptionAction, 
  getUserModelSettings, 
  updateUserModelSettings
} from '@/app/actions';
import Link from 'next/link';
import { Spinner } from '@/components/ui/spinner';
import { Menu, Transition } from '@headlessui/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSettingsChanged?: () => void;
}

// Extend state type for subscription details
interface SubscriptionDetailsState {
  planName: string | null;
  subscriptionId: string | null;
  canUpgrade: boolean;
  renewalDate: string | null;
  isCancelled: boolean;
}

// Model Settings Interface
interface ModelSetting {
  id: string; // Technical ID for API
  name: string; // Keep name if used elsewhere, or make it the display name
  displayName: string; // User-friendly name
  enabled: boolean;
}

// Define the available models with display names
const availableClaudeModels: Omit<ModelSetting, 'enabled'>[] = [
  { id: 'claude-3-7-sonnet-20250219', name: 'claude-3-7-sonnet-20250219', displayName: 'Claude 3.7 Sonnet' },
  { id: 'claude-3-opus-20240229', name: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus' }, 
  { id: 'claude-3-5-sonnet-20240620', name: 'claude-3-5-sonnet-20240620', displayName: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-sonnet-20240229', name: 'claude-3-sonnet-20240229', displayName: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku' },
  // Add other valid models as needed, remove invalid ones like 'claude-3.7-sonnet'
  // { id: 'claude-3-sonnet-20240229', name: 'claude-3-sonnet-20240229' }, 
];

// Helper function to capitalize first letter
function capitalizeFirstLetter(string: string | null): string {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function SettingsModal({ isOpen, setIsOpen, onSettingsChanged }: SettingsModalProps) {
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetailsState>({ planName: null, subscriptionId: null, canUpgrade: false, renewalDate: null, isCancelled: false });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessMessage, setCancelSuccessMessage] = useState<string | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);
  const [reactivateSuccessMessage, setReactivateSuccessMessage] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false); // Loading state for models
  const [isSavingModels, setIsSavingModels] = useState(false); // Saving state for models
  const [modelSaveError, setModelSaveError] = useState<string | null>(null); // Error state for models save

  // Model state - initialized empty, will be loaded
  const [models, setModels] = useState<ModelSetting[]>([]);

  // Updated useEffect to load settings
  useEffect(() => {
    async function fetchData() {
      if (isOpen) {
        setIsLoading(true);
        setIsLoadingModels(true);
        // Reset errors/messages
        setCancelError(null);
        setCancelSuccessMessage(null);
        setReactivateError(null);
        setReactivateSuccessMessage(null);
        setModelSaveError(null);
        try {
          // Fetch user email and subscription details (parallel fetch)
          const supabase = createSupabaseClient();
          const userPromise = supabase.auth.getUser();
          const subscriptionPromise = getSubscriptionDetails();
          const modelsPromise = getUserModelSettings();

          const [{ data: { user } }, subscriptionData, userSettings] = await Promise.all([
            userPromise,
            subscriptionPromise,
            modelsPromise
          ]);

          console.log("[MODAL LOG] Received userSettings from action:", userSettings);
          
          setUserEmail(user?.email ?? null);
          setSubscriptionDetails(subscriptionData);
          
          // Initialize models state using the correct field from the settings object
          setModels(
            availableClaudeModels.map(model => ({
              ...model,
              enabled: userSettings.enabledModels.includes(model.id)
            }))
          );

        } catch (error) {
          console.error("Error fetching settings data:", error);
          // Define fallback settings locally
          const fallbackEnabled = ['claude-3.5-sonnet', 'claude-3.7-sonnet', 'claude-3.7-sonnet-max'];
          setModels(
             availableClaudeModels.map(model => ({
              ...model,
              enabled: fallbackEnabled.includes(model.id) // Use the local fallback array
            }))
          );
        } finally {
          setIsLoading(false);
          setIsLoadingModels(false);
        }
      }
    }
    fetchData();
  }, [isOpen]);

  // Updated Model Checkbox Handler to save
  const handleCheckedChange = async (id: string, checked: boolean | 'indeterminate') => {
    const isTryingToDisable = !checked;
    const enabledModelsCount = models.filter(model => model.enabled).length;
    const changingModel = models.find(model => model.id === id);

    if (isTryingToDisable && changingModel?.enabled && enabledModelsCount <= 1) {
      console.log("Cannot disable the last enabled model.");
      setModelSaveError("At least one model must remain enabled."); // User feedback
      // Clear error after a delay
      setTimeout(() => setModelSaveError(null), 3000);
      return; 
    }
    
    // Optimistically update local state
    const newModelsState = models.map(model =>
      model.id === id ? { ...model, enabled: !!checked } : model
    );
    setModels(newModelsState);
    setModelSaveError(null); // Clear previous errors
    setIsSavingModels(true); // Set saving state

    // Prepare IDs to save
    const enabledIdsToSave = newModelsState
      .filter(model => model.enabled)
      .map(model => model.id);

    // Call server action to update settings
    try {
      const result = await updateUserModelSettings(enabledIdsToSave);
      if (!result.success) {
        setModelSaveError(result.error || "Failed to save model settings.");
      } else {
        console.log("Enabled model settings saved successfully.");
        onSettingsChanged?.();
      }
    } catch (error) {
       console.error("Error calling updateUserModelSettings:", error);
       setModelSaveError("An unexpected error occurred while saving enabled models.");
    } finally {
       setIsSavingModels(false); // Clear saving state
    }
  };

  async function handleCancel() {
    if (!subscriptionDetails.subscriptionId) return;

    setIsCancelling(true);
    setCancelError(null);
    setCancelSuccessMessage(null);
    setReactivateError(null);
    setReactivateSuccessMessage(null);
    try {
      const result = await cancelSubscriptionAction(subscriptionDetails.subscriptionId);
      if (result.success) {
        const details = await getSubscriptionDetails();
        setSubscriptionDetails(details);
        setCancelSuccessMessage("Subscription cancellation scheduled.");
      } else {
        setCancelError(result.error || "Failed to cancel subscription.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      setCancelError(message);
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleReactivate() {
    if (!subscriptionDetails.subscriptionId) return;
    setIsReactivating(true);
    setReactivateError(null);
    setReactivateSuccessMessage(null);
    setCancelError(null);
    setCancelSuccessMessage(null);
    try {
      const result = await reactivateSubscriptionAction(subscriptionDetails.subscriptionId);
      if (result.success) {
        const details = await getSubscriptionDetails();
        setSubscriptionDetails(details);
        setReactivateSuccessMessage("Subscription reactivated successfully.");
      } else {
        setReactivateError(result.error || "Failed to reactivate subscription.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      setReactivateError(message);
    } finally {
      setIsReactivating(false);
    }
  }

  function closeModal() {
    setIsOpen(false);
  }

  if (!isOpen) return null;

  const displayPlanName = subscriptionDetails.planName ? capitalizeFirstLetter(subscriptionDetails.planName) : 'Free';
  const isPaidPlan = !!subscriptionDetails.planName;

  const features = isPaidPlan ? [
    "Everything in Free",
    "Extended limits",
    "Standard and advanced voice mode",
    "Access to deep research",
    "Create custom GPTs",
    "Access to Sora (limited)",
    "Early access to new features"
  ] : [
    "Basic chatbot features",
    "Standard response speed",
    "Community support"
  ];

  const renderAccountContent = () => (
    <section aria-labelledby="account-heading" className="space-y-4">
       <h2 id="account-heading" className="text-lg font-semibold text-gray-900">Account Information</h2>
       <dl className="space-y-3">
         <div className="flex justify-between">
           <dt className="text-sm text-gray-600">Email address</dt>
           <dd className="text-sm font-medium text-gray-800">{userEmail ?? '-'}</dd>
         </div>
       </dl>
    </section>
  );

  const renderSubscriptionContent = () => (
    <section aria-labelledby="subscription-heading" className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 id="subscription-heading" className="text-lg font-semibold text-gray-900">{displayPlanName} Plan</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isPaidPlan 
              ? subscriptionDetails.isCancelled 
                ? `Plan cancelled. Access ends on ${subscriptionDetails.renewalDate || '[Date Unavailable]'}`
                : `Your plan auto-renews on ${subscriptionDetails.renewalDate || '[Date Unavailable]'}`
              : "Current plan details"}
          </p>
        </div>
        {isPaidPlan && (
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button as={Fragment}>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-10">
                <div className="px-1 py-1 ">
                  {subscriptionDetails.canUpgrade && (
                    <Menu.Item>
                      {({ active }) => (
                        <Link href="/pricing" passHref>
                          <button
                            onClick={closeModal}
                            className={`${ active ? 'bg-indigo-500 text-white' : 'text-gray-900' } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                          >
                             <ArrowUpCircle className="mr-2 h-5 w-5" aria-hidden="true" />
                            Upgrade plan
                          </button>
                        </Link>
                      )}
                    </Menu.Item>
                  )}
                  {subscriptionDetails.subscriptionId && (
                    <Menu.Item>
                      {({ active }) => (
                        subscriptionDetails.isCancelled ? (
                          <button
                            onClick={handleReactivate}
                            disabled={isReactivating}
                            className={`${ active ? 'bg-green-100 text-green-700' : 'text-green-600' } group flex w-full items-center rounded-md px-2 py-2 text-sm ${isReactivating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isReactivating ? (
                              <Spinner className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                              <RefreshCcw className="mr-2 h-5 w-5" aria-hidden="true" />
                            )}
                            Reactivate Subscription
                          </button>
                        ) : (
                          <button
                            onClick={handleCancel}
                            disabled={isCancelling}
                            className={`${ active ? 'bg-red-100 text-red-700' : 'text-red-600' } group flex w-full items-center rounded-md px-2 py-2 text-sm ${isCancelling ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isCancelling ? (
                              <Spinner className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                              <XCircle className="mr-2 h-5 w-5" aria-hidden="true" />
                            )}
                            Cancel Subscription
                          </button>
                        )
                      )}
                    </Menu.Item>
                  )}
                </div>
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <Link href="/pricing" passHref>
                         <button
                            onClick={closeModal}
                            className={`${ active ? 'bg-gray-100 text-gray-900' : 'text-gray-700' } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                          >
                            <LayoutGrid className="mr-2 h-5 w-5" aria-hidden="true" />
                            View Plans
                          </button>
                      </Link>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        )}
      </div>
      
      <div className="bg-gray-50 rounded-md p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {isPaidPlan ? "Thanks for subscribing! Features include:" : "Your Free plan includes:"}
        </h3>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mr-2 mt-0.5" aria-hidden="true" />
              <span className="text-sm text-gray-600">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="mt-4 text-center h-5">
         {cancelSuccessMessage && (
            <p className="text-sm text-green-600"> {cancelSuccessMessage}</p>
         )}
         {cancelError && (
            <p className="text-sm text-red-600">Error: {cancelError}</p>
         )}
         {reactivateSuccessMessage && (
            <p className="text-sm text-green-600"> {reactivateSuccessMessage}</p>
         )}
         {reactivateError && (
            <p className="text-sm text-red-600">Error: {reactivateError}</p>
         )}
      </div>

    </section>
  );

  // Updated render function for Models Tab
  const renderModelsContent = () => (
    <section aria-labelledby="models-heading" className="space-y-4 pt-4 relative">
       {/* Saving Overlay */} 
       {isSavingModels && (
         <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-md">
           <Spinner className="h-6 w-6" />
         </div>
       )}
       <h2 id="models-heading" className="text-lg font-semibold text-gray-900">Model Names</h2>
      <p className="text-sm text-gray-600 mb-6">
        Select the Claude models you want to enable for use in the application.
      </p>
       {isLoadingModels ? (
         <div className="flex justify-center items-center py-8"><Spinner /></div>
       ) : (
         <div className="space-y-4">
          {models.map((model) => (
            <div key={model.id} className="flex items-center space-x-3">
              <Checkbox
                id={model.id}
                checked={model.enabled}
                onCheckedChange={(checked: boolean | 'indeterminate') => handleCheckedChange(model.id, checked)}
                disabled={isSavingModels}
              />
              <Label 
                 htmlFor={model.id} 
                 className={cn(
                   "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                   isSavingModels && "opacity-50"
                 )}
              >
                {model.displayName}
              </Label>
            </div>
          ))}
         </div>
       )}
       {modelSaveError && <p className="mt-4 text-sm text-red-600">Error: {modelSaveError}</p>}
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeModal}>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <Button variant="ghost" size="icon" onClick={closeModal} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Tabs defaultValue="account" className="flex flex-1 overflow-hidden">
          <TabsList className="h-auto flex flex-col justify-start items-start p-4 space-y-1 w-48 border-r border-gray-200 bg-gray-50/50 rounded-none">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Settings</h3>
            <TabsTrigger 
              value="account" 
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left justify-start data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
               <User className="h-5 w-5 flex-shrink-0" />
               <span>Account</span>
            </TabsTrigger>
            <TabsTrigger 
              value="models" 
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left justify-start data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
               <List className="h-5 w-5 flex-shrink-0" />
               <span>Models</span>
             </TabsTrigger>
            <TabsTrigger 
              value="subscription" 
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left justify-start data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
             >
               <CreditCard className="h-5 w-5 flex-shrink-0" />
               <span>Subscription</span>
             </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="account" className="mt-0">
               {isLoading ? <Spinner /> : renderAccountContent()}
            </TabsContent>
            <TabsContent value="models" className="mt-0">
               {renderModelsContent()}
            </TabsContent>
            <TabsContent value="subscription" className="mt-0">
               {isLoading ? <Spinner /> : renderSubscriptionContent()}
               {cancelError && <p className="mt-4 text-sm text-red-600">Error: {cancelError}</p>}
               {cancelSuccessMessage && <p className="mt-4 text-sm text-green-600">{cancelSuccessMessage}</p>}
               {reactivateError && <p className="mt-4 text-sm text-red-600">Error: {reactivateError}</p>}
               {reactivateSuccessMessage && <p className="mt-4 text-sm text-green-600">{reactivateSuccessMessage}</p>}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
} 