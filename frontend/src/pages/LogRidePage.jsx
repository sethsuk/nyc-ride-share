import React, { useState } from 'react';
import { useUser } from '../context/UserContext.jsx';

export default function LogRidePage() {
  const { user } = useUser();
  const [formData, setFormData] = useState({
    request_datetime: '',
    on_scene_datetime: '',
    trip_time: '',
    PULocationID: '',
    DOLocationID: '',
    trip_miles: '',
    tolls: '',
    total_fare: '',
    driver_pay: '',
    tips: ''
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('http://localhost:5050/user/logUberRide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, ...formData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log ride');
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="log-ride-container">
      <h2>Log a New Uber Ride</h2>
      <form onSubmit={handleSubmit} className="log-ride-form">
        {Object.keys(formData).map((key) => (
          <div key={key}>
            <label>{key}</label>
            <input
              type="text"
              name={key}
              value={formData[key]}
              onChange={handleChange}
              required
            />
          </div>
        ))}
        <button type="submit">Submit</button>
      </form>
      {message && <div style={{ color: 'green' }}>{message}</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}