import { Helmet } from 'react-helmet-async';

export default function ResetPasswordPage() {
  return (
    <>
      <Helmet>
        <title>Reset Password - Talents Media</title>
      </Helmet>
      <div className="animated-gradient">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold text-white">Reset Password Page</h1>
          <p className="text-tm-text-muted mt-4">
            Reset password page - migrate from web/app/reset-password/page.tsx
          </p>
        </div>
      </div>
    </>
  );
}

