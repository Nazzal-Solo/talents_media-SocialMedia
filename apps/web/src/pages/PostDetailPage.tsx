import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <>
      <Helmet>
        <title>Post - Talents Media</title>
      </Helmet>
      <div className="animated-gradient">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold text-white">Post Detail Page</h1>
          <p className="text-tm-text-muted mt-4">
            Post ID: {id}
          </p>
          <p className="text-tm-text-muted mt-2">
            Post detail page - migrate from web/app/post/[id]/page.tsx
          </p>
        </div>
      </div>
    </>
  );
}

