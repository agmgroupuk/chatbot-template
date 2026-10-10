'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  Check,
  CircleHelp,
  Compass,
  Menu,
  MessageSquare,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

type Message = { sender: 'user' | 'ai'; content: string };

const suggestions = [
  { title: 'Write something', prompt: 'Help me write a clear, thoughtful email about ' },
  { title: 'Explore an idea', prompt: 'Help me explore this idea: ' },
  { title: 'Learn something', prompt: 'Explain this in simple terms: ' },
];

async function browserIdentity() {
  const details = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(details))),
  )
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

export function VisitorWorkspace({ landing = false }: { landing?: boolean }) {
  const [fingerprint, setFingerprint] = useState('');
  const [remaining, setRemaining] = useState<number | null>(10);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTitle = messages.find(message => message.sender === 'user')?.content;

  useEffect(() => {
    let active = true;
    browserIdentity()
      .then(async id => {
        if (!active) return;
        setFingerprint(id);
        const response = await fetch(`/api/workspace?fingerprint=${id}`, { cache: 'no-store' });
        const data = await response.json();
        if (active) {
          if (!response.ok) setError(data.error);
          else {
            setRemaining(data.remaining);
            setSignedIn(data.signedIn);
          }
        }
      })
      .catch(() => {
        if (active) setError('Unable to initialize the workspace. Please try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const startNewChat = useCallback(() => {
    if (busy) return;
    setMessages([]);
    setInput('');
    setError('');
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    function handleNewChatShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        startNewChat();
      }
    }
    window.addEventListener('keydown', handleNewChatShortcut);
    return () => window.removeEventListener('keydown', handleNewChatShortcut);
  }, [startNewChat]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !input.trim() || remaining === 0) return;
    const next = [...messages, { sender: 'user' as const, content: input.trim() }].slice(-19);
    const requestMessages = next.map(message => ({
      ...message,
      content: message.content.slice(0, 4000),
    }));
    while (
      requestMessages.length > 1 &&
      requestMessages.reduce((total, message) => total + message.content.length, 0) > 16000
    ) {
      requestMessages.shift();
    }
    setBusy(true);
    setError('');
    setMessages(next);
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint, messages: requestMessages }),
      });
      const data = await response.json();
      if (data.limited) setRemaining(0);
      if (!response.ok) throw new Error(data.error);
      setMessages([...next, { sender: 'ai', content: data.answer }]);
      setInput('');
      setRemaining(data.remaining);
    } catch (error) {
      setMessages(messages);
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  if (landing) {
    const allowance = signedIn
      ? 'Your account allowance'
      : `${remaining ?? 10} of 10 messages left today`;

    return (
      <div className="chat-app">
        <a className="skip-link" href="#chat-main">Skip to chat</a>
        {sidebarOpen && (
          <button
            className="chat-sidebar-backdrop"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className={`chat-sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label="Chat sidebar">
          <div className="chat-sidebar-brand">
            <Link href="/" className="chat-brand" aria-label="One Fin home">
              <span className="chat-brand-mark"><Sparkles size={17} /></span>
              <span>One Fin</span>
            </Link>
            <button className="chat-icon-button sidebar-close" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <button className="chat-new-button" onClick={startNewChat} disabled={busy}>
            <Plus size={18} />
            <span>New chat</span>
            <span className="new-chat-shortcut">Ctrl K</span>
          </button>

          <div className="chat-sidebar-section">
            <span className="chat-sidebar-label">Workspace</span>
            <Link className="chat-sidebar-link" href="/pricing">
              <Compass size={17} /><span>Explore plans</span>
            </Link>
            <Link className="chat-sidebar-link" href="/support">
              <CircleHelp size={17} /><span>Help center</span>
            </Link>
          </div>

          <div className="chat-sidebar-section recent-section">
            <span className="chat-sidebar-label">Recent</span>
            {activeTitle ? (
              <button className="chat-history-item" title={activeTitle} onClick={() => setSidebarOpen(false)}>
                <MessageSquare size={16} />
                <span>{activeTitle}</span>
              </button>
            ) : (
              <p className="chat-no-history">Your conversations will appear here.</p>
            )}
          </div>

          <div className="chat-sidebar-bottom">
            <div className="chat-allowance">
              <div className="allowance-heading">
                <span>Daily messages</span>
                <span>{remaining ?? 10}/10</span>
              </div>
              <div className="allowance-track" aria-label={allowance}>
                <span style={{ width: `${Math.max(0, Math.min(100, ((remaining ?? 10) / 10) * 100))}%` }} />
              </div>
              <p>{allowance}</p>
            </div>
            <Link className="chat-sidebar-link" href="/privacy">
              <Check size={17} /><span>Private guest session</span>
            </Link>
          </div>
        </aside>

        <main className="chat-main" id="chat-main">
          <header className="chat-topbar">
            <button className="chat-icon-button chat-menu-button" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}>
              <Menu size={19} />
            </button>
            <div className="chat-model-name"><Sparkles size={16} /><span>One Fin AI</span></div>
            <span className="chat-guest-label">Guest</span>
          </header>

          {messages.length === 0 ? (
            <section className="chat-welcome" aria-labelledby="chat-welcome-title">
              <div className="chat-welcome-mark"><Sparkles size={24} /></div>
              <p className="chat-welcome-eyebrow">A fresh space for your ideas</p>
              <h1 id="chat-welcome-title">What can I help you with?</h1>
              <p className="chat-welcome-copy">Ask anything, work through an idea, or get a hand with your next task.</p>
              <div className="chat-suggestions" aria-label="Conversation starters">
                {suggestions.map(suggestion => (
                  <button
                    className="chat-suggestion"
                    key={suggestion.title}
                    onClick={() => {
                      setInput(suggestion.prompt);
                      textareaRef.current?.focus();
                    }}
                  >
                    <span>{suggestion.title}</span>
                    <small>{suggestion.prompt}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="chat-messages" aria-label="Conversation">
              <div className="chat-message-list" role="log" aria-live="polite">
                {messages.map((message, index) => (
                  <article
                    className={`chat-message ${message.sender === 'user' ? 'user-message' : 'assistant-message'}`}
                    key={`${index}-${message.sender}`}
                  >
                    {message.sender === 'ai' && <span className="assistant-avatar"><Sparkles size={15} /></span>}
                    <div className="chat-message-content">
                      <span className="chat-message-author">{message.sender === 'user' ? 'You' : 'One Fin'}</span>
                      <p>{message.content}</p>
                    </div>
                  </article>
                ))}
                {busy && (
                  <div className="chat-message assistant-message" role="status">
                    <span className="assistant-avatar"><Sparkles size={15} /></span>
                    <div className="chat-message-content">
                      <span className="chat-message-author">One Fin</span>
                      <p className="chat-thinking"><i /><i /><i /> Thinking</p>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </section>
          )}

          <div className={`chat-composer-area${messages.length === 0 ? ' welcome-composer-area' : ''}`}>
            {error && <p className="chat-error" role="alert">{error}</p>}
            {remaining === 0 ? (
              <div className="chat-limit-panel" role="status">
                <h2>You’ve reached today’s message limit</h2>
                <p>Your free guest messages reset at midnight UTC. Explore a plan to keep chatting.</p>
                <Link className="chat-upgrade-link" href="/pricing">Explore plans</Link>
              </div>
            ) : (
              <form className="chat-composer" onSubmit={send}>
                <label className="sr-only" htmlFor="visitor-chat-message">Message One Fin</label>
                <textarea
                  id="visitor-chat-message"
                  ref={textareaRef}
                  aria-label="Workspace message"
                  placeholder="Message One Fin..."
                  maxLength={4000}
                  rows={2}
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  disabled={busy || !fingerprint}
                />
                <div className="chat-composer-bottom">
                  <span>Enter to send · Shift + Enter for a new line</span>
                  <button
                    className="chat-send-button"
                    aria-label="Send message"
                    title="Send message"
                    disabled={busy || !fingerprint || !input.trim()}
                  >
                    <ArrowUp size={19} />
                  </button>
                </div>
              </form>
            )}
            <p className="chat-privacy-note">
              One Fin can make mistakes. Don’t share sensitive personal information.{' '}
              <Link href="/privacy">Privacy details</Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="visitor-workspace">
      <div className="setting-row">
        <span className="badge">{signedIn ? 'Your account allowance' : `${remaining ?? 10} of 10 visitor responses left today`}</span>
        <Link className="button secondary small" href="/pricing">Explore plans & subscribe</Link>
      </div>
      <section className="panel stack" aria-label="Workspace conversation">
        <div role="log" aria-live="polite" className="stack">
          {messages.length ? messages.map((message, index) => (
            <div className="notice" key={index}>
              <strong>{message.sender === 'user' ? 'You' : 'One Fin'}</strong>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          )) : (
            <div className="empty-state">
              <h2>What would you like to work on?</h2>
              <p>Ask a question or bring an idea. You can start here immediately.</p>
            </div>
          )}
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {remaining === 0 ? (
          <div className="notice" role="status">
            <h2>Your visitor allowance is used up.</h2>
            <p>Continue with a card-backed free trial, sign in to use your account allowance, or subscribe. Visitor access resets at midnight UTC.</p>
            <div className="button-row">
              <Link className="button" href="/pricing">Start a free trial</Link>
              <Link className="button secondary" href="/sign-in?next=/workspace">Sign in</Link>
              <Link className="text-link" href="/subscribe?plan=monthly&mode=paid">Subscribe now</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="stack">
            <label className="field">
              Your message
              <textarea
                aria-label="Workspace message"
                required
                maxLength={4000}
                rows={4}
                value={input}
                onChange={event => setInput(event.target.value)}
                disabled={busy}
              />
            </label>
            <button className="button" disabled={busy || !fingerprint || !input.trim()}>
              {busy ? 'Thinking...' : 'Send message'}
            </button>
          </form>
        )}
      </section>
      <p className="small-copy">
        Visitor limits reset daily at midnight UTC. We use a secure cookie, hashed browser characteristics, and a hashed network identifier to limit misuse. Clearing browser data does not reset server records; shared networks can share a limit.{' '}
        <Link className="text-link" href="/privacy">Privacy details</Link>. This conversation stays in this page and is cleared when you leave. Account sessions require a fresh sign-in every 30 days.
      </p>
    </div>
  );
}
