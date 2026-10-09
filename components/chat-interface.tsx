'use client';

import { availableModels } from '@/lib/models';
import { useWorkspacePreferences } from './workspace-preferences';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Check, Loader2, PlusIcon, BookText } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getUserModelSettings, updateUserSelectedModel, getAIResponse, addMessage, getMessagesForChat } from '@/app/actions'; // Keep model actions if needed in chat view
import { SettingsModal } from './settings-modal';
import { v4 as uuidv4 } from 'uuid';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ContextSelectorModal } from "./context-selector-modal";
import { ContextItem } from '@/app/actions';

// Define available models with display names within this component
// TODO: Centralize this definition later if needed
const availableModelsForDisplay = availableModels;

// Helper to find display name from ID
const getDisplayName = (id: string | null): string | null => {
  if (!id) return null;
  const model = availableModelsForDisplay.find(m => m.id === id);
  return model ? model.displayName : id; // Fallback to ID if not found
};

// --- Types ---
interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
}

interface ChatInterfaceProps {
  chatId: string;
}

export function ChatInterface({ chatId }: ChatInterfaceProps) {
  const preferences = useWorkspacePreferences();
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Chat State (Specific to this chat session) ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiResponding, setIsAiResponding] = useState(false);

  // --- Model/Settings State (Copied from IdeInterface for now) ---
  // This might need to be fetched or managed differently in a real app
  // depending on whether settings apply globally or per chat.
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelDropdownPosition, setModelDropdownPosition] = useState({ top: 0, left: 0 });
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [hasTriggeredInitialResponse, setHasTriggeredInitialResponse] = useState(false); // Flag to prevent multiple triggers

  // --- State for Context Modal ---
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);

  // --- New State for Attached Context ---
  const [attachedContextItem, setAttachedContextItem] = useState<ContextItem | null>(null);

  // --- New State for Attached Image ---

  // --- Calculate Attachment Count ---
  const attachmentCount = (attachedContextItem ? 1 : 0);

  // --- Load Models (Copied from IdeInterface for now) ---
  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const settings = await getUserModelSettings();
      setEnabledModels(settings.enabledModels);
      setSelectedModel(settings.selectedModel);
    } catch (error) {
      console.error("Failed to fetch user model settings:", error);
      setEnabledModels([]);
      setSelectedModel(null);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // --- Combined useEffect for initial loading ---
  useEffect(() => {
    let isMounted = true; // Prevent state updates if component unmounts
    setIsLoadingMessages(true); // Start loading messages
    setMessageError(null);
    setHasTriggeredInitialResponse(false); // Reset flag on chat change
    setAttachedContextItem(null); // Clear attached context on chat change
    loadModels(); // Load model settings concurrently

    // Fetch existing messages
    getMessagesForChat(chatId)
      .then(fetchedMessages => {
        if (isMounted) {
            setMessages(fetchedMessages);
            setIsLoadingMessages(false);


        }
      })
      .catch(error => {
        console.error("Failed to fetch chat messages:", error);
        if (isMounted) {
          setMessageError("Failed to load chat history.");
          setIsLoadingMessages(false);
        }
      });

      return () => { isMounted = false; }; // Cleanup function

  }, [chatId, loadModels]); // Only depend on chatId and loadModels

  // --- Function to trigger the initial AI response ---
  // Renamed from handleInitialPromptFlow
  const triggerInitialResponse = useCallback(async (initialUserMessage: Message) => {
      const currentModel = selectedModel;
      if (!currentModel) {
        setMessageError('No AI model selected for initial response.');
        return;
      }

      setIsAiResponding(true);
      if (textareaRef.current) textareaRef.current.disabled = true;

      try {
        // Use the potentially updated currentModel
        const result = await getAIResponse([initialUserMessage], currentModel);

        let aiContent: string;
        let messageToSave: Message | null = null;

        if (result.success && result.response) {
          aiContent = result.response;
          messageToSave = { id: uuidv4(), sender: 'ai', content: aiContent };

          const saved = await addMessage(chatId, 'ai', aiContent, currentModel);
          if (!saved.success) setMessageError('Reply generated, but could not be saved. Copy it before refreshing.');

        } else {
          aiContent = `Error: ${result.error || 'Failed to get response from AI.'}`;
          messageToSave = { id: uuidv4(), sender: 'ai', content: aiContent };
          console.error("Initial AI Error:", result.error);
        }
        setMessages(prev => [...prev, messageToSave!]);
      } catch (error) {
        console.error("Error calling getAIResponse (initial flow):", error);
        const errorMsg: Message = { id: uuidv4(), sender: 'ai', content: "An error occurred while processing your request." };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        // Add a small delay before hiding loading to ensure it renders
        setTimeout(() => {
          setIsAiResponding(false);
          if (textareaRef.current) textareaRef.current.disabled = false;
          textareaRef.current?.focus();
        }, 50); // 50ms delay
      }
  }, [chatId, selectedModel]); // Dependencies

  // Effect to trigger initial response if messages load BEFORE models
   useEffect(() => {
     if (!isLoadingMessages && !isLoadingModels && !hasTriggeredInitialResponse && messages.length === 1 && messages[0].sender === 'user') {
       setHasTriggeredInitialResponse(true); // Set flag
       triggerInitialResponse(messages[0]);
     }
   }, [isLoadingMessages, isLoadingModels, messages, hasTriggeredInitialResponse, triggerInitialResponse]);

  const handleSettingsChanged = useCallback(() => {
     loadModels();
  }, [loadModels]);

  // ... textarea resize effect ...
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 48), 360);
      textarea.style.height = `${newHeight}px`;
    }
  }, [prompt]);

  // ... dropdown close effect ...
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const dropdownElement = document.querySelector('.fixed.bg-white.rounded-md.shadow-lg');
      if (dropdownElement && !dropdownElement.contains(target) && !dropdownRef.current?.contains(target)) {
        setIsModelDropdownOpen(false);
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isModelDropdownOpen]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  // --- Updated handler to accept ContextItem and store it ---
  const handleAddContext = (item: ContextItem) => {
    setAttachedContextItem(item);
    textareaRef.current?.focus();
  };

  // --- Handler to remove attached context ---
  const handleRemoveContext = () => {
    setAttachedContextItem(null);
    textareaRef.current?.focus();
  };

  // --- Updated handleSubmit to include attached context ---
  const handleSubmit = async () => {
    const currentPrompt = prompt.trim();
    // Only require typed prompt now. Attachments are handled separately.
    if (!currentPrompt || isAiResponding || !selectedModel) {
        if (!selectedModel) console.error("Submit cancelled: No model selected");
        return;
    }

    // NOTE: We are NOT prepending context/image info to the user message content here.
    // separately if it needs to use them.
    const newUserMessage: Message = {
      id: uuidv4(),
      sender: 'user',
      content: currentPrompt // Send only the typed prompt
    };

    // Include the user message in the list sent to the API
    // The API might need modification if it relies on context being inline
    const updatedMessagesForApi = [...messages, newUserMessage];
    setMessages(updatedMessagesForApi); // Update UI immediately

    // Clear prompt and attachments
    setPrompt("");
    setAttachedContextItem(null);

    setIsAiResponding(true);
    if(textareaRef.current) textareaRef.current.disabled = true;

    try {
      const savedUser = await addMessage(chatId, 'user', currentPrompt);
      if (!savedUser.success) {
        setMessageError('Unable to save your message. Please try again.');
        setMessages(messages);
        setPrompt(currentPrompt);
        return;
      }
      // Pass the updated message list AND the context item ID
      const result = await getAIResponse(
          updatedMessagesForApi,
          selectedModel,
          attachedContextItem?.id || null // Pass the context ID here
      );

      let aiContent: string;
      let messageToSave: Message | null = null;

      if (result.success && result.response) {
        aiContent = result.response;
         messageToSave = {
              id: uuidv4(),
              sender: 'ai',
              content: aiContent
            };
        const saved = await addMessage(chatId, 'ai', aiContent, selectedModel);
        if (!saved.success) setMessageError('Reply generated, but could not be saved. Copy it before refreshing.');
      } else {
        aiContent = `Error: ${result.error || 'Failed to get response from AI.'}`;
        messageToSave = {
              id: uuidv4(),
              sender: 'ai',
              content: aiContent
            };
        console.error("Follow-up AI Error:", result.error);
      }
      setMessages(prev => [...prev, messageToSave!]);

    } catch (error) {
      console.error("Error calling getAIResponse (follow-up):", error);
      const errorMsg: Message = {
        id: uuidv4(),
        sender: 'ai',
        content: "An error occurred while processing your request."
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiResponding(false);
      if(textareaRef.current) textareaRef.current.disabled = false;
      textareaRef.current?.focus();
    }
  };

  // Submit only requires prompt text now
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (preferences.enter_to_send && !e.nativeEvent.isComposing && e.key === 'Enter' && !e.shiftKey && prompt.trim() && !isAiResponding) {
        e.preventDefault();
        handleSubmit();
    }
  };

  // --- handleModelSelect ---
  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);
    setIsModelDropdownOpen(false);
    try {
      // Ensure updateUserSelectedModel is imported if needed here
      await updateUserSelectedModel(modelId);
    } catch (error) {
       console.error("Error calling updateUserSelectedModel:", error);
    }
  };

  // --- scroll effect ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ... JSX for the Active Chat View ---
  return (
    <div className="h-full flex flex-col">
      {/* Chat message display area - Removed padding from main */}
      <main> { /* Removed p-6 pb-24 and other classes*/ }
        {/* Added bottom padding here to prevent overlap with sticky input */}
        <div className="w-full max-w-3xl mx-auto space-y-6 pb-24">
          {/* Loading state for messages */}
          {isLoadingMessages && (
            <>
              <Skeleton className="h-10 w-3/4 rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg self-end" />
              <Skeleton className="h-10 w-3/4 rounded-lg" />
            </>
          )}
          {/* Error state for messages */}
          {!isLoadingMessages && messageError && (
            <div className="text-center text-red-600 py-4">{messageError}</div>
          )}
          {/* Display existing/new messages */}
          {!isLoadingMessages && !messageError && messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                { /* User Message Styling */ }
                {msg.sender === 'user' && (
                    <div className="max-w-[75%] px-4 py-2 rounded-xl bg-gray-100 text-gray-800">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                )}
                { /* AI Message Styling */ }
                {msg.sender === 'ai' && (
                    <div className="max-w-[90%] text-gray-800">
                        {/* AI Content - No background bubble */}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                )}
            </div>
          ))}

          {/* AI Loading Indicator */}
          {isAiResponding && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-500 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          {/* Element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area - Sticky at the bottom */}
      <div className="w-full max-w-3xl mx-auto pb-4 sticky bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent pt-4">
        <div className="relative rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {/* Input Row */}
          <div className="flex flex-col">
            {/* Text input section */}
            <div className="w-full relative">
              <textarea
                spellCheck={preferences.spellcheck}
                aria-label="Message"
                ref={textareaRef}
                // Reverted class changes, context no longer shown here
                className={`w-full resize-none text-base focus:outline-none text-stone-900 placeholder:text-gray-500 bg-transparent px-5 py-3 min-h-[48px] max-h-[360px] pr-10`}
                placeholder={"Ask follow-up..."} // Reverted placeholder
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleTextareaKeyDown}
                rows={1}
                disabled={isAiResponding}
              />
            </div>

            {/* Controls section */}
            <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-between">
              {/* Left Controls */}
              <div className="flex items-center gap-2">
                {/* Model Selector */}
                <div className="relative" ref={dropdownRef}>
                   <button
                        className="text-gray-500 flex items-center gap-1 text-sm hover:bg-gray-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={(e) => {
                            if (isLoadingModels) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setModelDropdownPosition({ top: rect.top - 4, left: rect.left });
                            setIsModelDropdownOpen(!isModelDropdownOpen);
                        }}
                        disabled={isLoadingModels}
                    >
                        <span>
                            {isLoadingModels ? 'Loading...' : getDisplayName(selectedModel) ? getDisplayName(selectedModel) : enabledModels.length > 0 ? 'Select Model' : 'No Models Enabled'}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 10L4 6H12L8 10Z" fill="#6B7280"/></svg>
                    </button>
                    {/* Model Dropdown Portal */}
                    {isModelDropdownOpen && typeof document !== 'undefined' && createPortal(
                        <div className="fixed bg-white rounded-md shadow-lg border border-gray-200 w-56 z-50" style={{ top: `${modelDropdownPosition.top}px`, left: `${modelDropdownPosition.left}px`, transform: 'translateY(-100%)' }}>
                            <div className="p-1.5">
                            {enabledModels.map((modelId) => {
                                const displayName = getDisplayName(modelId);
                                return (
                                    <div
                                        key={modelId}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer rounded-md"
                                        onClick={() => handleModelSelect(modelId)}
                                    >
                                        <span className="text-gray-800 text-sm">{displayName}</span>
                                        {selectedModel === modelId && <Check className="h-4 w-4 text-black" strokeWidth={2} />}
                                    </div>
                                );
                            })}
                            {enabledModels.length === 0 && !isLoadingModels && (
                                <div className="px-3 py-2 text-sm text-gray-500 text-center"> No models enabled. Go to Settings &gt; Models. </div>
                            )}
                            </div>
                        </div>,
                    document.body)}
                </div>
                {/* Add Content Dropdown with Badge */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative text-gray-500 hover:bg-gray-100 h-8 w-8 p-1.5 rounded-md mr-2" // Added relative positioning
                      aria-label="Add content"
                      // Removed disabled logic based on attachment
                    >
                      <PlusIcon className="h-5 w-5" />
                      {/* --- Attachment Count Badge --- */}
                      {attachmentCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-white text-[10px] font-semibold">
                          {attachmentCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {/* --- Conditional Image Item --- */}

                    {/* --- Updated Context Item (to match IdeInterface) --- */}
                    <DropdownMenuItem
                      disabled={!preferences.context_enabled}
                      onSelect={() => setIsContextModalOpen(true)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <BookText className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="flex-grow">Add Context</span>
                      </div>
                      {attachedContextItem && <Check className="h-4 w-4 text-black ml-2 flex-shrink-0" strokeWidth={2} />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Submit Button */}
              <button
                className={`flex items-center justify-center h-8 w-8 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ prompt.trim() ? "bg-black text-white hover:bg-gray-800" : "bg-white text-gray-400 border border-gray-300"}`}
                aria-label="Submit prompt"
                onClick={handleSubmit}
                // Disable only if prompt is empty or AI is responding
                disabled={!prompt.trim() || isAiResponding}
              >
                {isAiResponding ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal (Can be kept or removed depending on desired functionality) */}
      <SettingsModal
         isOpen={isSettingsModalOpen}
         setIsOpen={setIsSettingsModalOpen}
         onSettingsChanged={handleSettingsChanged}
       />

      {/* --- Render Context Modal (with updated props) --- */}
      <ContextSelectorModal
        isOpen={isContextModalOpen}
        setIsOpen={setIsContextModalOpen}
        onAddContext={handleAddContext}
        attachedContextItemId={attachedContextItem?.id || null} // Pass current ID
        onRemoveContext={handleRemoveContext} // Pass remove handler
      />

      {/* --- Hidden File Input (remains) --- */}
    </div>
  );
}
