import React, { useState } from 'react';
import { useUser } from '../context/UserContext.jsx';

export default function LogRidePage() {
  const { user } = useUser(); // assuming this returns the username string
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

    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
  const { name, value } = e.target;
  setFormData((prev) => ({
    ...prev,
    [name]: value
  }));
};

  const handleSubmit = async (e) => {
  e.preventDefault();

  const rideData = {
    username: user,
    request_datetime: formData.request_datetime ? new Date(formData.request_datetime).toISOString() : null,
    on_scene_datetime: formData.on_scene_datetime ? new Date(formData.on_scene_datetime).toISOString() : null,
    trip_time: parseInt(formData.trip_time),
    PULocationID: parseInt(formData.PULocationID),
    DOLocationID: parseInt(formData.DOLocationID),
    trip_miles: parseFloat(formData.trip_miles),
    tolls: parseFloat(formData.tolls),
    total_fare: parseFloat(formData.total_fare),
    driver_pay: parseFloat(formData.driver_pay),
    tips: parseFloat(formData.tips)
  };

  

  try {
    const response = await fetch('http://localhost:5050/user/logUberRide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rideData)
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Ride logged successfully!');
      setError('');
    } else {
      setError('Failed to log ride');
      setMessage('');
      console.error(result.error);
    }
  } catch (err) {
    console.error('Error submitting form:', err);
    setError('Failed to log ride');
    setMessage('');
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
            type={key.includes('datetime') ? 'datetime-local' : 'text'}
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