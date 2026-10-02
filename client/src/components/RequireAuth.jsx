import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentUser } from '../lib/session';

export default function RequireAuth() {
  const user = getCurrentUser();
  const expired = user?.exp && user.exp * 1000 < Date.now();

  if (!user || expired) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
