import { VisitorWorkspace } from '@/components/visitor-workspace';

export const metadata = {
  title: 'AI Chat | One Fin Solution',
  description: 'Start chatting with One Fin AI. No sign-in or account required.',
};

export default function Home() {
  return (
    <div className="page-wrap home-chat-page">
      <section className="home-chat-intro" aria-labelledby="home-chat-title">
        <p className="eyebrow">ONE FIN AI</p>
        <h1 id="home-chat-title">What can I help you with?</h1>
        <p>Ask a question, explore an idea, or get help with your next task.</p>
      </section>
      <VisitorWorkspace landing />
    </div>
  );
}
