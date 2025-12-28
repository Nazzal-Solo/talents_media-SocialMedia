import { Helmet } from 'react-helmet-async';

export default function ProfilePage() {
  return (
    <>
      <Helmet>
        <title>Profile - Talents Media</title>
      </Helmet>
      <div className="animated-gradient">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold text-white">Profile Page</h1>
          <p className="text-tm-text-muted mt-4">
            Profile page - migrate from web/app/profile/page.tsx
          </p>
        </div>
      </div>
    </>
  );
}

