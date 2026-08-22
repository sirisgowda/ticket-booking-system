import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import EventsList from './pages/EventsList';
import ShowDetail from './pages/ShowDetail';
import BookingHistory from './pages/BookingHistory';
import OrganiserDashboard from './pages/OrganiserDashboard';
import AdminVenues from './pages/AdminVenues';

export default function App() {
  return (
    <div>
      <NavBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <EventsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:id"
          element={
            <ProtectedRoute>
              <ShowDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shows/:id/checkout"
          element={
            <ProtectedRoute>
              <ShowDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute roles={['customer']}>
              <BookingHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organiser"
          element={
            <ProtectedRoute roles={['organiser']}>
              <OrganiserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminVenues />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
