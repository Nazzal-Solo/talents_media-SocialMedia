// This page uses the same component as LoginPage with toggle
// For now, redirect to login page with register mode
import { Navigate } from 'react-router-dom';

export default function RegisterPage() {
  // LoginPage handles both login and register modes
  // You can either:
  // 1. Use LoginPage with a query param: ?mode=register
  // 2. Create a separate RegisterPage component
  // For now, redirecting to login (LoginPage handles both)
  return <Navigate to="/login" replace />;
}

