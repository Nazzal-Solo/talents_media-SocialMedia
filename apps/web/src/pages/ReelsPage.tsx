import { Helmet } from 'react-helmet-async';

export default function ReelsPage() {
  return (
    <>
      <Helmet>
        <title>Reels - Talents Media</title>
      </Helmet>
      <div className="animated-gradient">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold text-white">Reels Page</h1>
          <p className="text-tm-text-muted mt-4">
            Reels page - migrate from web/app/reels/page.tsx
          </p>
        </div>
      </div>
    </>
  );
}

