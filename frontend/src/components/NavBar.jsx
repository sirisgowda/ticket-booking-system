import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="nav">
      <div>
        <Link to="/">Events</Link>
        {user?.role === 'customer' && <Link to="/bookings">My Bookings</Link>}
        {user?.role === 'organiser' && <Link to="/organiser">Organiser Dashboard</Link>}
        {user?.role === 'admin' && <Link to="/admin">Admin: Venues</Link>}
      </div>
      <div>
        {user ? (
          <>
            <span style={{ marginRight: 12 }}>
              {user.name} ({user.role})
            </span>
            <button
              className="btn secondary"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}
