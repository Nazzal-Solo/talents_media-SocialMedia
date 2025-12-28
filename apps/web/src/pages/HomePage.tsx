import { Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';
import { Feed } from '@/components/feed';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Talents Media</title>
        <meta name="description" content="A modern social media platform with dark neon theme" />
      </Helmet>
      
      <div className="animated-gradient">
        {/* Fixed Navigation */}
        <Navbar />
        
        {/* Main Layout Container */}
        <div className="mx-auto w-full max-w-[1600px] grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1.8fr)_minmax(260px,0.9fr)] gap-6 px-4 pt-24 lg:px-6">
          {/* Left Sidebar - Desktop Only */}
          <aside 
            className="hidden lg:flex flex-col gap-6 sticky top-24 max-h-[calc(100vh-96px)] overflow-y-auto pr-1 scrollbar-hide flex-shrink-0"
          >
            <Sidebar />
          </aside>
          
          {/* Main Content Area */}
          <main className="flex flex-col gap-6 w-full min-w-0 pb-6">
            <Suspense fallback={<LoadingSpinner />}>
              <Feed />
            </Suspense>
          </main>
          
          {/* Right Sidebar - Large Desktop Only */}
          <aside className="hidden xl:flex flex-col gap-6 sticky top-24 max-h-[calc(100vh-96px)] overflow-y-auto scrollbar-hide flex-shrink-0">
            <div className="glass-card p-4">
              <h3 className="text-lg font-semibold mb-4">Coming Soon</h3>
              <p className="text-sm text-tm-text-muted">
                Additional features and widgets will appear here.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

