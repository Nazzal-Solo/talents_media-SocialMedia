import { Helmet } from 'react-helmet-async';

export default function ChatPage() {
  return (
    <>
      <Helmet>
        <title>Chat - Talents Media</title>
      </Helmet>
      <div className="animated-gradient">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold text-white">Chat Page</h1>
          <p className="text-tm-text-muted mt-4">
            Chat page - migrate from web/app/chat/page.tsx
          </p>
        </div>
      </div>
    </>
  );
}

