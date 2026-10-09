"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  Mail,
  ArrowRight,
  Settings,
  LogOut,
  User,
  MoreHorizontal,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseClient } from "@/utils/supabase/client";
import { SettingsModal } from "./settings-modal";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { getChatHistory, deleteChat } from "@/app/actions";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatHistoryItem {
  id: string;
  title: string;
}

function capitalizeFirstLetter(string: string | null): string {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Define SocialLink at the top level
const SocialLink = ({ icon: Icon, text, href }: { icon: React.ElementType, text: string, href: string }) => (
  <a 
    href={href} 
    target="_blank" 
    rel="noopener noreferrer"
    className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 transition-colors"
  >
    <Icon className="h-4 w-4 text-stone-500" />
    <span>{text}</span>
  </a>
);

export interface SidebarProps {
  className?: string;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
  isAuthenticated: boolean;
  activePlanName: string | null;
  isSubscriptionLoading: boolean;
}

export function SidebarComponent({ className, onToggleCollapse, collapsed = false, isAuthenticated, activePlanName, isSubscriptionLoading }: SidebarProps) {
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // --- State for Chat History ---
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // --- State for Delete Confirmation ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const profileButton = document.querySelector('.profile-button');
      if (
        profileMenuRef.current && 
        !profileMenuRef.current.contains(event.target as Node) &&
        !(profileButton && profileButton.contains(event.target as Node))
      ) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- useEffect to fetch chat history --- 
  useEffect(() => {
    console.log("[Sidebar Effect] Running due to auth/path change:", { isAuthenticated, pathname });
    if (isAuthenticated) { 
      setIsLoadingHistory(true);
      setHistoryError(null);
      getChatHistory()
        .then(history => {
          console.log("[Sidebar Effect] Fetched history:", history);
          setChatHistory(history);
        })
        .catch(error => {
          console.error("Sidebar fetch history error:", error);
          setHistoryError("Failed to load history.");
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      console.log("[Sidebar Effect] Clearing history due to !isAuthenticated");
      setChatHistory([]);
      setIsLoadingHistory(false);
    }
  }, [isAuthenticated, pathname]);

  const handleCollapseClick = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  const toggleWorkspace = () => setIsWorkspaceCollapsed(!isWorkspaceCollapsed);
  const toggleHistory = () => setIsHistoryCollapsed(!isHistoryCollapsed);

  const handleSignOut = async () => {
    const client = createSupabaseClient();
    await client.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  // Custom X Logo Component
  const XLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      shapeRendering="geometricPrecision" 
      textRendering="geometricPrecision" 
      imageRendering="optimizeQuality" 
      fillRule="evenodd" 
      clipRule="evenodd" 
      viewBox="0 0 512 462.799" 
      {...props}
    >
      <path 
        fillRule="nonzero" 
        d="M403.229 0h78.506L310.219 196.04 512 462.799H354.002L230.261 301.007 88.669 462.799h-78.56l183.455-209.683L0 0h161.999l111.856 147.88L403.229 0zm-27.556 415.805h43.505L138.363 44.527h-46.68l283.99 371.278z"
        fill="currentColor"
      />
    </svg>
  );

  // --- Define the callback for settings changes --- 
  const handleSettingsChanged = () => {
    console.log("[Sidebar] Settings changed, refreshing router...");
    router.refresh();
  };

  const handleDeleteChat = async () => {
    if (!chatToDelete || isDeleting) return;

    const deletedChatId = chatToDelete.id;
    setIsDeleting(true);
    setIsDeleteModalOpen(false);

    try {
      const result = await deleteChat(deletedChatId);
      if (result.success) {
        setChatHistory(prevHistory => prevHistory.filter(chat => chat.id !== deletedChatId));
        
        if (pathname === `/c/${deletedChatId}`) {
          router.push('/');
        }
      } else {
        console.error("Failed to delete chat:", result.error);
        // TODO: Show error toast to user
      }
    } catch (error) {
      console.error("Error calling deleteChat:", error);
      // TODO: Show error toast
    } finally {
      setIsDeleting(false);
      setChatToDelete(null);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col h-full border-r border-stone-200 bg-stone-50 transition-all duration-300 ease-in-out", 
        collapsed ? "w-0" : "w-[260px]", 
        className
      )}
      style={{
        "--sidebar-mask": "linear-gradient(to right, black calc(100% - 80px), transparent calc(100% - 20px))"
      } as React.CSSProperties}
    >
      {!collapsed && (
        <>
          <div className="flex items-center justify-between p-4 flex-shrink-0">
            <div className="flex items-center h-[26px]">
              <span 
                className="font-bold text-2xl text-zinc-900" 
                style={{ lineHeight: '26px', marginTop: '-3px' }}
              >
                start
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full transition-all duration-300 ease-in-out hover:bg-stone-200"
              onClick={handleCollapseClick}
            >
              <ChevronLeft className="h-4 w-4" /> 
            </Button>
          </div>
          
          <div className="px-3 py-2 flex-shrink-0">
            <Button
              variant="ghost"
              className="w-full text-stone-700 hover:bg-stone-200 px-1.5"
              onClick={() => router.push('/')}
            >
              <div className="flex items-center gap-2 w-full">
                <Plus className="h-4 w-4" />
                <span>New project</span>
              </div>
            </Button>
          </div>

          <Separator className="bg-stone-200"/>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="mb-2">
              <button 
                className="flex items-center justify-between w-full px-1.5 py-1.5 text-sm font-bold text-stone-700 rounded-md"
                onClick={toggleWorkspace}
              >
                <span className="text-left">Workspace</span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 transition-transform text-stone-500",
                    isWorkspaceCollapsed ? "-rotate-90" : ""
                  )}
                />
              </button>
              {!isWorkspaceCollapsed && (
                <div className="mt-1 space-y-1 animate-in fade-in duration-200">
                   <Button 
                     variant="ghost" 
                     className="justify-start w-full text-stone-700 hover:bg-stone-200 text-sm px-1.5"
                     onClick={() => router.push('/context')}
                   >
                     <div className="flex items-center gap-2 w-full text-left">
                       <span>📖</span> <span>Context</span>
                     </div>
                   </Button>

                </div>
              )}
            </div>

            <Separator className="bg-stone-200 my-3"/>

            <div className="mb-2">
              <button 
                className="flex items-center justify-between w-full px-1.5 py-1.5 text-sm font-bold text-stone-700 rounded-md"
                onClick={toggleHistory}
              >
                <span className="text-left">History</span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 transition-transform text-stone-500",
                    isHistoryCollapsed ? "-rotate-90" : ""
                  )}
                />
              </button>
              {!isHistoryCollapsed && (
                <div className="mt-1 space-y-1 animate-in fade-in duration-200 w-full overflow-hidden">
                  {/* Loading State */}
                  {isLoadingHistory && (
                    <>
                      <Skeleton className="h-8 w-full rounded-lg" />
                      <Skeleton className="h-8 w-full rounded-lg" />
                    </>
                  )}
                  {/* Error State */}
                  {!isLoadingHistory && historyError && (
                     <p className="px-1.5 py-2 text-sm text-red-600">{historyError}</p>
                  )}
                  {/* Empty State */}
                  {!isLoadingHistory && !historyError && chatHistory.length === 0 && (
                    <p className="px-1.5 py-2 text-sm text-stone-500">No chat history yet.</p>
                  )}
                  {/* History List */}
                  {!isLoadingHistory && !historyError && chatHistory.map((chat) => (
                    <div 
                      key={chat.id}
                      className="group relative flex items-center w-full overflow-hidden min-w-0"
                    >
                      <Button 
                         variant="ghost" 
                         className="justify-start text-stone-700 hover:bg-stone-200 text-sm px-1.5 py-2 h-auto flex-grow mr-1 min-w-0"
                         onClick={() => router.push(`/c/${chat.id}`)}
                         disabled={isDeleting && chatToDelete?.id === chat.id}
                      >
                        <div className="relative grow overflow-hidden whitespace-nowrap text-left min-w-0" style={{ maskImage: "var(--sidebar-mask)" }}>
                          {isDeleting && chatToDelete?.id === chat.id ? 'Deleting...' : chat.title}
                        </div>
                      </Button>
                      {/* Three Dot Menu Button - Opens Modal */}
                       <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 p-0 flex-shrink-0 text-stone-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatToDelete(chat);
                            setIsDeleteModalOpen(true);
                          }}
                          disabled={isDeleting && chatToDelete?.id === chat.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Conditionally render Upgrade section based on loading state */}
          {isAuthenticated && !isSubscriptionLoading && !activePlanName && (
            <>
              <Separator className="bg-stone-200"/>
              <div className="px-3 py-2 flex flex-col gap-y-1 flex-shrink-0">
                <Button 
                  variant="outline"
                  className="w-full justify-start gap-2 border-stone-200 text-stone-700 hover:bg-stone-200"
                  onClick={() => router.push('/pricing')}
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>Upgrade Plan</span>
                </Button>
              </div>
            </>
          )}
          
          {/* Social Feedback Section (Separator is now only rendered once) */}
          <Separator className="bg-stone-200"/>
          <div className="px-5 py-4">
            <h3 className="text-sm font-medium text-stone-800 mb-3">Feedback? DM us!</h3>
            <div className="space-y-2.5">
              <SocialLink icon={XLogo} text="@wymi_" href="https://x.com/wymi_" />
              <SocialLink icon={Mail} text="Contact us" href="mailto:feedback@example.com" /> 
            </div>
          </div>

          {/* Profile Section (Moved here) */}
           <div className="p-3 border-t border-stone-200">
             <div className="relative">
               <button 
                 className="w-full h-10 bg-stone-50 text-stone-900 hover:bg-stone-200 rounded-lg flex items-center px-4 shadow-none profile-button"
                 onClick={(e) => {
                   e.stopPropagation();
                   setShowProfileMenu(!showProfileMenu);
                 }}
               >
                 <div className="flex items-center gap-2 grow">
                   <User className="h-4 w-4 flex-shrink-0" />
                   <span>Profile</span>
                   {/* Use PROP for tag */}
                   <span className="text-xs px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded-full">
                     {activePlanName ? capitalizeFirstLetter(activePlanName) : 'Free'}
                   </span>
                 </div>
                 <ChevronDown className={cn(
                   "h-4 w-4 transition-transform flex-shrink-0 ml-2",
                   showProfileMenu ? "rotate-180" : ""
                 )} />
               </button>
               
               {showProfileMenu && (
                 <div 
                   ref={profileMenuRef}
                   className="absolute bottom-full left-0 w-full bg-white rounded-lg shadow-lg border border-stone-200 py-1 mb-1"
                 >
                   <button 
                     className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-stone-100 text-stone-700"
                     onClick={() => {
                       setIsSettingsModalOpen(true);
                       setShowProfileMenu(false); // Close profile menu when opening modal
                     }}
                   >
                     <Settings className="h-4 w-4" />
                     <span>Settings</span>
                   </button>
                   <Separator className="my-1" />
                   <button 
                     className="w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-stone-100 text-red-600"
                     onClick={handleSignOut}
                   >
                     <LogOut className="h-4 w-4" />
                     <span>Sign out</span>
                   </button>
                 </div>
               )}
             </div>
           </div>
        </>
      )}
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        setIsOpen={setIsSettingsModalOpen} 
        onSettingsChanged={handleSettingsChanged} 
      />
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        setIsOpen={setIsDeleteModalOpen}
        itemTitle={chatToDelete?.title ?? null}
        onConfirmDelete={handleDeleteChat}
        isDeleting={isDeleting}
      />
    </div>
  );
} 