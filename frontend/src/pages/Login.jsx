import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="card">
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <button className="btn" type="submit">
          Login
        </button>
      </form>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Demo accounts (after running the seed script): admin@example.com / organiser@example.com /
        customer@example.com, password: password123
      </p>
    </div>
  );
}
