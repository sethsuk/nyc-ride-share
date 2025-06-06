import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from "../context/UserContext.jsx";
import bcrypt from 'bcryptjs';
import './LoginPage.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch('http://localhost:5050/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      const match = await bcrypt.compare(password, data.hashed_password);
      if (!match) {
        setError('Incorrect password');
      } else {
        setUser(username);
        navigate('/home');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Login</h1>
        <form onSubmit={handleLogin} className="login-form">
          <div>
            <label className="login-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              required
            />
          </div>
          <div>
            <label className="login-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button
            type="submit"
            className="login-button"
          >
            Login
          </button>
        </form>
  
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Don’t have an account? <Link to="/register" className="link-text">Register</Link>
        </p>
      </div>
    </div>
  );
}