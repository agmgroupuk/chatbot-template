"use server";

import { createSupabaseClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { encodedRedirect } from "@/utils/redirect";
import { revalidatePath } from "next/cache";
import { createUpdateClient } from "@/utils/update/server";
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from "@supabase/supabase-js";
// Assuming MessageParam might not be found by linter yet
// import { MessageParam } from '@anthropic-ai/sdk/resources/messages'; 

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const client = await createSupabaseClient();

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Provide a more user-friendly error message
    let errorMessage = error.message;
    
    if (error.message.includes("Invalid login credentials")) {
      errorMessage = "We couldn't find an account with these credentials. Please double-check your email and password.";
    } else if (error.message.includes("Email not confirmed")) {
      errorMessage = "Your email hasn't been verified yet. Please check your inbox.";
    }
    
    return encodedRedirect("error", "/sign-in", errorMessage);
  }

  // Check if email is confirmed
  const user = data.user;
  if (!user.email_confirmed_at) {
    // Email not confirmed, redirect to confirmation page
    return encodedRedirect("success", `/confirmation?email=${encodeURIComponent(email)}`, "Please confirm your email to continue.");
  }

  // Revalidate the root path to refresh client state
  revalidatePath("/");
  
  // Email confirmed, redirect to home page
  return redirect("/");
};

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const client = await createSupabaseClient();

  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').origin}/auth/callback`,
    },
  });

  if (error) {
    // Provide a more user-friendly error message
    let errorMessage = error.message;
    
    if (error.message.includes("already registered")) {
      errorMessage = "This email is already registered. Please sign in instead.";
    } else if (error.message.includes("weak password")) {
      errorMessage = "Please use a stronger password. It should be at least 6 characters long.";
    }
    
    return encodedRedirect("error", "/sign-up", errorMessage);
  }

  // Redirect to confirmation page with the email
  return redirect(`/confirmation?email=${encodeURIComponent(email)}`);
};

export const signOutAction = async () => {
  const client = await createSupabaseClient();
  await client.auth.signOut();
  return redirect("/sign-in");
};

export async function createCheckout(priceId: string) {
  "use server";
  
  const client = await createUpdateClient();
  const { data, error } = await client.billing.createCheckoutSession(
    priceId,
    { redirect_url: `${new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').origin}/account?checkout=success` }
  );

  if (error) {
    throw new Error("Failed to create checkout session");
  }

  return redirect(data.url);
}

// Formats UTC date string to Month Day, Year
function formatRenewalDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    // Ensure the date is valid before formatting
    if (isNaN(date.getTime())) {
      console.warn("Invalid date string received:", dateString);
      return null;
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC' // Specify UTC to avoid local time zone shifts
    });
  } catch (e) {
    console.error("Error formatting date:", e);
    return null;
  }
}

// Server Action to get detailed subscription status
export async function getSubscriptionDetails(): Promise<{
  planName: string | null;
  subscriptionId: string | null;
  canUpgrade: boolean;
  renewalDate: string | null;
  isCancelled: boolean;
}> {
  let planName: string | null = null;
  let subscriptionId: string | null = null;
  let canUpgrade = false;
  let currentPrice = -1; 
  let renewalDate: string | null = null;
  let isCancelled = false;

  try {
    const updateClient = await createUpdateClient();
    
    // Fetch current subscription(s)
    const { data: subData, error: subError } = await updateClient.billing.getSubscriptions();

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
    } else {
      const activeSub = subData?.subscriptions?.find(
        (sub) => sub.status === 'active'
      );

      if (activeSub) {
        subscriptionId = activeSub.id;
        planName = activeSub.product?.name ?? null; 
        currentPrice = activeSub.price?.unit_amount ?? -1; 
        // Format renewal date
        renewalDate = formatRenewalDate(activeSub.current_period_end);
        // Get cancellation status
        isCancelled = activeSub.cancel_at_period_end;

         if (!planName) {
            console.warn("Active subscription found but product name is missing. Sub ID:", subscriptionId);
         }
      }
    }

    // Fetch all products to check for potential upgrades
    const { data: prodData, error: prodError } = await updateClient.billing.getProducts();
    if (prodError) {
      console.error("Error fetching products:", prodError);
    } else if (prodData?.products) {
      if (currentPrice > -1) {
         canUpgrade = prodData.products.some(product => 
           product.prices?.some(price => 
             price.unit_amount !== null && price.unit_amount > currentPrice
           )
         );
      } else {
         canUpgrade = prodData.products.some(product => 
           product.prices?.some(price => price.unit_amount !== null && price.unit_amount > 0)
         );
      }
    }

    return { planName, subscriptionId, canUpgrade, renewalDate, isCancelled };

  } catch (err) {
    console.error("Unexpected error checking subscription details:", err);
    // Return defaults including new fields
    return { planName: null, subscriptionId: null, canUpgrade: false, renewalDate: null, isCancelled: false };
  }
}

// Server Action to cancel a subscription
export async function cancelSubscriptionAction(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
   if (!subscriptionId) {
     return { success: false, error: "Subscription ID is required." };
   }
   try {
     const updateClient = await createUpdateClient();
     // Using the CORRECT method: updateSubscription with cancel_at_period_end
     const { error } = await updateClient.billing.updateSubscription(subscriptionId, {
       cancel_at_period_end: true,
     });

     if (error) {
       console.error("Error cancelling subscription:", error);
       return { success: false, error: error.message || "Failed to cancel subscription." };
     }

     revalidatePath("/"); // Revalidate relevant paths after cancellation
     revalidatePath("/pricing");
     // Consider revalidating other paths where subscription state is shown

     return { success: true };

   } catch (err: unknown) { // Use unknown instead of any
     console.error("Unexpected error cancelling subscription:", err);
     // Type check the error
     const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
     return { success: false, error: errorMessage };
   }
}

// Server Action to reactivate a subscription
export async function reactivateSubscriptionAction(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
  if (!subscriptionId) {
    return { success: false, error: "Subscription ID is required." };
  }
  try {
    const updateClient = await createUpdateClient();
    const { error } = await updateClient.billing.updateSubscription(subscriptionId, {
      cancel_at_period_end: false, // Set to false to reactivate
    });

    if (error) {
      console.error("Error reactivating subscription:", error);
      return { success: false, error: error.message || "Failed to reactivate subscription." };
    }

    revalidatePath("/"); 
    revalidatePath("/pricing");
    // Consider revalidating other paths

    return { success: true };

  } catch (err: unknown) { 
    console.error("Unexpected error reactivating subscription:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

// --- Model Settings Types --- 
// Keep interface exported
export interface UserModelSettings {
  enabledModels: string[];
  selectedModel: string | null;
}

// Default settings constant
const defaultModelSettings: UserModelSettings = {
  enabledModels: [
    'claude-3-7-sonnet-20250219', // Added 3.7
    'claude-3-5-sonnet-20240620', 
    'claude-3-sonnet-20240229', 
    'claude-3-haiku-20240307'
  ],
  selectedModel: 'claude-3-7-sonnet-20250219' // Make 3.7 default selected
};

/**
 * Fetches the user's model settings (enabled models and last selected model).
 * Returns default settings if no user or profile found, or if columns are null.
 */
export async function getUserModelSettings(): Promise<UserModelSettings> {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // console.warn("getUserModelSettings: No user found."); // Keep warn?
    return defaultModelSettings; 
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('enabled_models, selected_model') 
      .eq('id', user.id)
      .single(); 

    // console.log("[ACTION LOG] Raw data fetched from DB:", data); // Removed log

    if (error) {
      if (error.code === 'PGRST116') { 
        // console.warn(`getUserModelSettings: Profile not found for user ${user.id}. Returning default.`); // Keep warn?
        // console.log("[ACTION LOG] Returning default models (profile not found - PGRST116):", defaultModelSettings); // Removed log
        return defaultModelSettings;
      }
      console.error("Error fetching user model settings:", error);
      throw error; 
    }

    // Process the fetched data, providing defaults if columns are null
    const settings: UserModelSettings = {
        enabledModels: data?.enabled_models ?? defaultModelSettings.enabledModels,
        selectedModel: data?.selected_model ?? null 
    };

    // Validate if the saved selected model is actually enabled
    if (settings.selectedModel && !settings.enabledModels.includes(settings.selectedModel)) {
        // console.log(`[ACTION LOG] Saved selected model '${settings.selectedModel}' is not in enabled list. Resetting selection.`); // Removed log
        if (defaultModelSettings.selectedModel && settings.enabledModels.includes(defaultModelSettings.selectedModel)) {
             settings.selectedModel = defaultModelSettings.selectedModel;
        } else if (settings.enabledModels.length > 0) {
            settings.selectedModel = settings.enabledModels[0];
        } else {
            settings.selectedModel = null;
        }
    } else if (!settings.selectedModel && settings.enabledModels.length > 0) {
        if (defaultModelSettings.selectedModel && settings.enabledModels.includes(defaultModelSettings.selectedModel)) {
             settings.selectedModel = defaultModelSettings.selectedModel;
        } else {
            settings.selectedModel = settings.enabledModels[0];
        }
    }

    // console.log("[ACTION LOG] Returning processed user settings:", settings); // Removed log
    return settings;

  } catch (err) {
    console.error("Unexpected error in getUserModelSettings:", err);
    // console.log("[ACTION LOG] Returning default models (due to catch block):", defaultModelSettings); // Removed log
    return defaultModelSettings;
  }
}

// Server Action to update the list of enabled models
// --- MODIFIED --- Now also handles updating selected_model if it becomes disabled
export async function updateUserModelSettings(enabledIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated:", authError);
      return { success: false, error: "User not authenticated." };
    }

    // 1. Get the current selected model BEFORE updating from the CORRECT table
    const { data: currentSettings, error: fetchError } = await supabase
      .from('profiles') 
      .select('selected_model')
      .eq('id', user.id) 
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { 
       console.error("Error fetching current settings from profiles:", fetchError);
       return { success: false, error: "Failed to fetch current settings." };
    }

    const currentSelectedModel = currentSettings?.selected_model;
    let newSelectedModel = currentSelectedModel; 

    // 2. Check if the current selected model is being disabled
    if (currentSelectedModel && !enabledIds.includes(currentSelectedModel)) {
      // console.log(`Selected model '${currentSelectedModel}' is being disabled.`); // Removed log
      // 3. Determine the new selected model (first enabled or null)
      newSelectedModel = enabledIds.length > 0 ? enabledIds[0] : null;
      // console.log(`Automatically setting new selected model to: '${newSelectedModel}'`); // Removed log
    } else {
      // Ensure selected model is valid even if not changed (e.g., on first save or if current was null)
      if (currentSelectedModel && !enabledIds.includes(currentSelectedModel)) {
         newSelectedModel = enabledIds.length > 0 ? enabledIds[0] : null;
      } else if (!currentSelectedModel && enabledIds.length > 0) {
         newSelectedModel = enabledIds[0];
      }
    }

    // 4. Update BOTH enabled_models and selected_model in the CORRECT table
    const { error: updateError } = await supabase
      .from('profiles') 
      .update({ 
        enabled_models: enabledIds,
        selected_model: newSelectedModel, 
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id); 

    if (updateError) {
      console.error("Error updating user settings in profiles:", updateError);
      return { success: false, error: "Failed to update model settings." };
    }

    revalidatePath("/"); 

    return { success: true };

  } catch (err: unknown) {
    console.error("Unexpected error in updateUserModelSettings:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

// Server Action to update ONLY the selected model (used by dropdown)
// --- CORRECTED --- Use 'profiles' table and 'id' column
export async function updateUserSelectedModel(modelId: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated:", authError);
      return { success: false, error: "User not authenticated." };
    }

    const { error: updateError } = await supabase
      .from('profiles') 
      .update({ 
        selected_model: modelId,
        updated_at: new Date().toISOString(),
      })
       .eq('id', user.id); 

    if (updateError) {
      console.error("Error updating selected model in profiles:", updateError);
      return { success: false, error: "Failed to update selected model." };
    }

    revalidatePath("/");

    return { success: true };

  } catch (err: unknown) {
    console.error("Unexpected error in updateUserSelectedModel:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

// Message type used by the chat interface (can be shared or redefined)
// Ensure this matches the structure expected by the server action
interface ClientMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
}

// Helper function to fetch context item by ID (reusable)
async function getContextItemContent(itemId: string | null | undefined, supabase: SupabaseClient): Promise<string | null> {
  if (!itemId) return null;

  const { data: contextItem, error: contextError } = await supabase
      .from('context_items')
      .select('content, name') // Select name for formatting
      .eq('id', itemId)
      .maybeSingle(); // Use maybeSingle as it might not exist

  if (contextError) {
    console.error(`Error fetching context item ${itemId}:`, contextError);
    // Decide if this should be a critical error or just ignored
    return null; 
  }
  
  if (!contextItem) {
    console.warn(`Context item with ID ${itemId} not found.`);
    return null;
  }

  // Return formatted content
  return `--- Context: ${contextItem.name} ---\n${contextItem.content}\n--- End Context ---`;
}

// --- Server Action for Anthropic API Call (Updated) ---
export async function getAnthropicResponse(
  messages: ClientMessage[], 
  model: string,
  contextItemId?: string | null // Added optional context item ID
): Promise<{ success: boolean; response?: string; error?: string }> {
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in environment variables.");
    return { success: false, error: "Server configuration error: API key missing." };
  }
  if (!model) {
     return { success: false, error: "No model selected." };
  }
  if (messages.length === 0) {
     return { success: false, error: "No messages to send." };
  }

  const supabase = await createSupabaseClient(); // Create client once
  const anthropic = new Anthropic({ apiKey });

  // Fetch context content if ID is provided
  let fetchedContextContent: string | null = null;
  if (contextItemId) {
    try {
      fetchedContextContent = await getContextItemContent(contextItemId, supabase);
      if (fetchedContextContent) {
         console.log(`Successfully fetched context: ${contextItemId}`);
      } else {
         console.log(`Could not fetch or find context: ${contextItemId}`);
         // Decide if this failure should abort the request or proceed without context
         // For now, we proceed without context
      }
    } catch (fetchErr) {
       console.error(`Caught error fetching context ${contextItemId}:`, fetchErr);
       // Proceed without context on fetch error
    }
  }

  // Convert client messages
  const formattedMessages: Anthropic.MessageParam[] = messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));

  // Prepend context to the *last user message* if fetched
  // (Alternatively, could add as a separate user message, or system prompt if API supports it)
  if (fetchedContextContent && formattedMessages.length > 0) {
      const lastMessageIndex = formattedMessages.length - 1;
      // Ensure the last message is from the user before modifying
      if (formattedMessages[lastMessageIndex].role === 'user') {
          const originalContent = formattedMessages[lastMessageIndex].content;
          formattedMessages[lastMessageIndex].content = `${fetchedContextContent}\n\n${originalContent}`;
          console.log(`Prepended context to user message for Anthropic API call.`);
      } else {
          // If the last message isn't user, perhaps add context as a new user message?
          // Or log a warning and proceed without prepending. For simplicity, we log.
          console.warn("Last message not from user, could not prepend context directly.");
          // Option: formattedMessages.push({ role: 'user', content: fetchedContextContent });
      }
  }

  try {
    console.log(`Calling Anthropic API with model: ${model}`);
    const response = await anthropic.messages.create({
      model: model, 
      max_tokens: 1024, 
      messages: formattedMessages,
    });
    console.log("Anthropic API Response Status:", response.stop_reason);
    type ContentBlock = { type: string; text?: string }; 
    const textBlocks = response.content
      .filter((block: ContentBlock): block is { type: 'text'; text: string } => 
        block.type === 'text' && typeof block.text === 'string'
      );
    const aiTextResponse = textBlocks
      .map((textBlock) => (textBlock as { text: string }).text) 
      .join('\n');
    if (!aiTextResponse && response.content.length > 0 && textBlocks.length === 0) {
       console.warn("Anthropic response contained no usable text content.", response.content);
       return { success: true, response: "" }; 
    }
    if (!aiTextResponse && response.content.length === 0) {
        console.warn("Anthropic API response was empty.", response);
        return { success: false, error: "Received an empty response from AI." };
    }
    return { success: true, response: aiTextResponse };
  } catch (error: unknown) {
    console.error("Error calling Anthropic API:", error);
    let errorMessage = "An unexpected error occurred while contacting the AI.";
    if (error instanceof Anthropic.APIError) {
        errorMessage = `Anthropic API Error (${error.status}): ${error.message}`; 
    } else if (error instanceof Error) { 
        errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

// --- End Model Settings Actions --- 

// --- Chat History Actions --- 

/**
 * Creates a new chat record and saves the initial user message.
 * (Updated to accept contextItemId)
 */
export async function startNewChat(
  chatId: string,
  initialUserPrompt: string,
  selectedModelId: string | null,
  contextItemId?: string | null // Added optional context item ID
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated:", authError);
      return { success: false, error: "User not authenticated." };
    }

    // Fetch context content if ID is provided
    let fetchedContextContent: string | null = null;
    if (contextItemId) {
       try {
         fetchedContextContent = await getContextItemContent(contextItemId, supabase);
         if (fetchedContextContent) {
            console.log(`Successfully fetched context for new chat: ${contextItemId}`);
         } else {
            console.log(`Could not fetch or find context for new chat: ${contextItemId}`);
         }
       } catch (fetchErr) {
          console.error(`Caught error fetching context ${contextItemId} for new chat:`, fetchErr);
       }
    }

    // Prepend context to the initial prompt if fetched
    const finalUserPrompt = fetchedContextContent
       ? `${fetchedContextContent}\n\n${initialUserPrompt}`
       : initialUserPrompt;

    // Generate initial chat name (or maybe generate AFTER first AI response?)
    const initialChatName = finalUserPrompt.substring(0, 50) + (finalUserPrompt.length > 50 ? '...' : '');

    // Replace RPC call with separate inserts
    // 1. Create the chat record
    const { error: chatInsertError } = await supabase
      .from('chats')
      .insert({
        id: chatId, // Use the client-generated ID
        user_id: user.id,
        model_id: selectedModelId, // Store initial model
        name: initialChatName 
        // created_at and updated_at have defaults
      });

    if (chatInsertError) {
      console.error("Error inserting chat record:", chatInsertError);
       // Check for duplicate chat ID specifically
       if (chatInsertError.code === '23505') { // PostgreSQL duplicate key error code
         return { success: false, error: "Chat ID already exists. Please try again." };
      }
      return { success: false, error: "Failed to create chat session." };
    }

    // 2. Save the initial user message
    const { error: messageInsertError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id: user.id,
        sender: 'user',
        content: finalUserPrompt, // Use the potentially modified prompt
        model_id: selectedModelId // Also store the model used for the prompt context if any
        // created_at has default
      });

    if (messageInsertError) {
      console.error("Error inserting initial user message:", messageInsertError);
      // Potentially attempt to clean up the created chat record here if needed
      // await supabase.from('chats').delete().eq('id', chatId);
      return { success: false, error: "Failed to save initial message." };
    }

    // Revalidate the root path to update the sidebar
    revalidatePath("/");

    console.log(`Successfully created chat ${chatId} and saved initial message.`);
    return { success: true };

  } catch (err: unknown) {
    console.error("Unexpected error in startNewChat:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Adds a message (typically AI response) to an existing chat 
 * and updates the chat's updated_at timestamp.
 */
export async function addMessage(
   chatId: string, 
   sender: 'user' | 'ai', // Allow saving user messages later if needed
   content: string, 
   modelId?: string | null // Optional model ID for AI messages
 ): Promise<{ success: boolean; error?: string }> {
   try {
     const supabase = await createSupabaseClient();
     const { data: { user }, error: authError } = await supabase.auth.getUser();
 
     if (authError || !user) {
       console.error("User not authenticated for addMessage:", authError);
       return { success: false, error: "User not authenticated." };
     }
 
     // Use a transaction to ensure both message insert and chat update happen or fail together
     const { error: transactionError } = await supabase.rpc('add_chat_message', {
         p_chat_id: chatId,
         p_user_id: user.id,
         p_sender: sender,
         p_content: content,
         p_model_id: modelId
     });
 
     if (transactionError) {
       console.error("Error in add_chat_message transaction:", transactionError);
       return { success: false, error: "Failed to save message and update chat." };
     }
     
    // Revalidate relevant paths
    // revalidatePath(`/c/${chatId}`); // Revalidate the specific chat page
    // revalidatePath('/'); // Or broader if sidebar shows updates

     return { success: true };
 
   } catch (err: unknown) {
     console.error("Unexpected error in addMessage:", err);
     const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
     return { success: false, error: errorMessage };
   }
 }
 
/**
 * Fetches the chat history list for the authenticated user.
 */
export async function getChatHistory(): Promise<{ id: string; title: string }[]> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for getChatHistory:", authError);
      return []; // Return empty list if not authenticated
    }

    const { data, error } = await supabase
      .from('chats')
      .select('id, name, created_at') // Keep fetching name
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("Error fetching chat history:", error);
      return [];
    }

    // Format the title: Use saved name first, then fallback
    return data.map(chat => ({
      id: chat.id,
      title: chat.name || `Chat ${chat.id.substring(0, 8)}...` // Use chat.name if available
    }));

  } catch (err: unknown) {
    console.error("Unexpected error in getChatHistory:", err);
    return [];
  }
}

// Define Message type consistent with DB and client needs
// (Could be moved to a shared types file)
interface MessageFromDB {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  created_at: string; // Timestamps from DB are strings
}

/**
 * Fetches messages for a specific chat ID belonging to the authenticated user.
 */
export async function getMessagesForChat(chatId: string): Promise<MessageFromDB[]> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for getMessagesForChat:", authError);
      return []; // Return empty list if not authenticated
    }

    // Fetch messages - RLS policies should ensure user owns the chat
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender, content, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true }); // Order messages chronologically

    if (error) {
      // RLS might deny access, resulting in an error or empty data depending on policy
      console.error("Error fetching messages for chat:", error);
      return [];
    }

    // Ensure sender is correctly typed
    return data.map(msg => ({
      ...msg,
      sender: msg.sender as 'user' | 'ai' // Assert type based on DB constraint
    }));

  } catch (err: unknown) {
    console.error("Unexpected error in getMessagesForChat:", err);
    return [];
  }
}

/**
 * Updates the name of a specific chat owned by the authenticated user.
 */
export async function updateChatName(
  chatId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for updateChatName:", authError);
      return { success: false, error: "User not authenticated." };
    }

    // Ensure the new name is not empty (optional, but good practice)
    if (!newName || newName.trim().length === 0) {
      return { success: false, error: "Chat name cannot be empty." };
    }

    const { error } = await supabase
      .from('chats')
      .update({ 
          name: newName.trim(), // Trim whitespace
          updated_at: new Date().toISOString() // Also update timestamp
      })
      .eq('id', chatId)
      .eq('user_id', user.id); // IMPORTANT: Ensure user owns the chat

    if (error) {
      console.error("Error updating chat name:", error);
      return { success: false, error: "Failed to update chat name." };
    }
    
    // Revalidate sidebar after name update
    revalidatePath('/'); 

    return { success: true };

  } catch (err: unknown) {
    console.error("Unexpected error in updateChatName:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Deletes a specific chat and its messages owned by the authenticated user.
 */
export async function deleteChat(
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for deleteChat:", authError);
      return { success: false, error: "User not authenticated." };
    }

    // Ensure chatId is provided
    if (!chatId) {
      return { success: false, error: "Chat ID is required." };
    }

    // Delete the chat record. RLS policies on 'chats' table should enforce user_id check.
    // Assuming CASCADE DELETE is set up on the 'messages' table for 'chat_id' foreign key.
    // If not, you would need to delete messages first:
    // const { error: msgError } = await supabase.from('messages').delete().eq('chat_id', chatId);
    // if (msgError) { /* handle message deletion error */ }
    
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', user.id); // Double-check ownership in the action too

    if (error) {
      console.error("Error deleting chat:", error);
      // Check if the error is due to the chat not being found (potentially already deleted)
      // Supabase delete doesn't typically throw an error if the row doesn't exist based on the filter,
      // but it's good practice to handle potential errors.
      if (error.code === 'PGRST116') { // Example error code, adjust if needed
         console.warn(`Chat ${chatId} not found for deletion, might be already deleted.`);
         // Consider returning success: true if not found is acceptable
         return { success: true }; 
      }
      return { success: false, error: "Failed to delete chat." };
    }

    // Revalidate the root path to refresh the sidebar
    revalidatePath('/');

    return { success: true };

  } catch (err: unknown) {
    console.error("Unexpected error in deleteChat:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

// --- End Chat History Actions ---

// --- Context Item Actions ---

// Interface for context items (can be shared with client)
export interface ContextItem {
  id: string;
  user_id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches all context items for the authenticated user.
 */
export async function getContextItems(): Promise<ContextItem[]> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for getContextItems:", authError);
      return []; // Return empty list if not authenticated
    }

    const { data, error } = await supabase
      .from('context_items')
      .select('*') // Select all columns
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("Error fetching context items:", error);
      return []; // Return empty on error
    }

    return data as ContextItem[]; // Cast data to our interface type

  } catch (err: unknown) {
    console.error("Unexpected error in getContextItems:", err);
    return [];
  }
}

/**
 * Adds a new context item for the authenticated user.
 */
export async function addContextItem(
  name: string,
  content: string
): Promise<{ success: boolean; error?: string; newItem?: ContextItem }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for addContextItem:", authError);
      return { success: false, error: "User not authenticated." };
    }

    // Basic validation (Keep for name)
    if (!name || name.trim().length === 0) {
      return { success: false, error: "Context item name cannot be empty." };
    }
    // Restore content validation
    if (!content || content.trim().length === 0) {
      return { success: false, error: "Context item content cannot be empty." };
    }

    // Insert the new item and return it
    const { data, error } = await supabase
      .from('context_items')
      .insert({
        user_id: user.id,
        name: name.trim(),
        content: content.trim(), 
        // created_at and updated_at have defaults
      })
      .select() // Return the newly inserted row
      .single(); // Expect only one row back

    if (error) {
      console.error("Error inserting context item:", error);
      return { success: false, error: "Failed to add context item." };
    }

    revalidatePath('/context'); // Revalidate the context page

    return { success: true, newItem: data as ContextItem };

  } catch (err: unknown) {
    console.error("Unexpected error in addContextItem:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Updates an existing context item owned by the authenticated user.
 */
export async function updateContextItem(
  itemId: string,
  newName: string,
  newContent: string
): Promise<{ success: boolean; error?: string; updatedItem?: ContextItem }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for updateContextItem:", authError);
      return { success: false, error: "User not authenticated." };
    }

    // Basic validation
    if (!itemId) {
      return { success: false, error: "Item ID is required." };
    }
    if (!newName || newName.trim().length === 0) {
      return { success: false, error: "Context item name cannot be empty." };
    }
    if (!newContent || newContent.trim().length === 0) {
      return { success: false, error: "Context item content cannot be empty." };
    }

    // Update the item and return it
    const { data, error } = await supabase
      .from('context_items')
      .update({
        name: newName.trim(),
        content: newContent.trim(),
        // updated_at trigger handles timestamp
      })
      .eq('id', itemId)
      .eq('user_id', user.id) // Ensure user owns the item
      .select()
      .single();

    if (error) {
      console.error("Error updating context item:", error);
      // Handle case where item might not be found for the user
      if (error.code === 'PGRST116') { // PostgREST code for zero rows returned
        return { success: false, error: "Context item not found or you do not have permission to update it." };
      }
      return { success: false, error: "Failed to update context item." };
    }

    revalidatePath('/context');

    return { success: true, updatedItem: data as ContextItem };

  } catch (err: unknown) {
    console.error("Unexpected error in updateContextItem:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Deletes a specific context item owned by the authenticated user.
 */
export async function deleteContextItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for deleteContextItem:", authError);
      return { success: false, error: "User not authenticated." };
    }

    if (!itemId) {
      return { success: false, error: "Item ID is required." };
    }

    // Delete the item
    const { error } = await supabase
      .from('context_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id); // Ensure user owns the item

    if (error) {
      console.error("Error deleting context item:", error);
      // Note: Supabase delete doesn't typically error if row not found with matching filters
      return { success: false, error: "Failed to delete context item." };
    }

    revalidatePath('/context');

    return { success: true };

  } catch (err: unknown) {
    console.error("Unexpected error in deleteContextItem:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetches a single context item by its ID for the authenticated user.
 */
export async function getContextItemById(itemId: string): Promise<ContextItem | null> {
  if (!itemId) {
    console.warn("getContextItemById: No itemId provided.");
    return null;
  }
  try {
    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("User not authenticated for getContextItemById:", authError);
      return null; // Return null if not authenticated
    }

    const { data, error } = await supabase
      .from('context_items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', user.id) // Ensure user owns the item
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Ignore 'No rows found' error, just return null
         console.error("Error fetching single context item:", error);
      }
      return null; // Return null on error or if not found/authorized
    }

    return data as ContextItem;

  } catch (err: unknown) {
    console.error("Unexpected error in getContextItemById:", err);
    return null;
  }
}

// --- End Context Item Actions ---
