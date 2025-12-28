import { Helmet } from 'react-helmet-async';

export default function ForgotPasswordPage() {
  return (
    <>
      <Helmet>
        <title>Forgot Password - Talents Media</title>
      </Helmet>
      <div className="animated-gradient">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold text-white">Forgot Password Page</h1>
          <p className="text-tm-text-muted mt-4">
            Forgot password page - migrate from web/app/forgot-password/page.tsx
          </p>
        </div>
      </div>
    </>
  );
}

