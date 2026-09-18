import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export default function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="spinner" />;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
