// src/pages/homeScreen.jsx
import React, { useState, useEffect } from 'react';
import Map from 'react-map-gl/mapbox';
import * as turf from '@turf/turf';
import { useUser } from '../context/UserContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function HomeScreen() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [zoneData, setZoneData] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [originCoords, setOriginCoords] = useState(null);
  const [destination, setDestination] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [choosingOrigin, setChoosingOrigin] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [results, setResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);

  const displayResults = (data) => {
    setResults(data);
    setShowResultsModal(true);
  };

  const queryRoute1 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/avgFareWeather?temperature=25&rain=0&wind_speed=5`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute1:', err);
    }
  };

  const queryRoute2 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/avgFareEstimate?puLocationId=${origin}&doLocationId=${destination}&temperature=25&rain=0&windSpeed=5&tripMiles=5`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute2:', err);
    }
  };

  const queryRoute3 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/averageTripTime?Pickup_id=${origin}&Dropoff_id=${destination}&Temperature=25&Rain=0&Wind_speed=5`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute3:', err);
    }
  };

  const queryRoute4 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/similar?username=${user}&input_pu=${origin}&input_do=${destination}&input_time=2024-01-01T12:00:00Z&input_temp=25&input_rain=0`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute4:', err);
    }
  };

  const queryRoute5 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/high-fare-hours`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute5:', err);
    }
  };

  const queryRoute6 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/stats/extreme-weather-routes`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute6:', err);
    }
  };

  const queryRoute7 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/rush-hour-analysis`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute7:', err);
    }
  };

  const queryRoute8 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/outlier-rides`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute8:', err);
    }
  };

  const queryRoute9 = async () => {
    try {
      const response = await fetch(`http://localhost:5050/rides/stats/hourly-user-aggregates`);
      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error in queryRoute9:', err);
    }
  };

  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    fetch('/data/taxi_zones.geojson')
      .then(res => res.json())
      .then(data => setZoneData(data))
      .catch(err => console.log('error loading taxi data:', err));
  }, []);

  useEffect(() => {
    if (!destinationCoords) return;
    const { lat, lng } = destinationCoords;
    const key = import.meta.env.VITE_OPENWEATHER_API_KEY;
    Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${key}`).then(r => r.json()),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${key}`).then(r => r.json())
    ])
    .then(([current, forecast]) => setWeatherData({ current, forecast }))
    .catch(err => console.error('weather fetch error:', err));
  }, [destinationCoords]);

  function getTaxiZoneFromPoint(lng, lat) {
    if (!zoneData?.features) return null;
    const point = turf.point([lng, lat]);
    for (const feature of zoneData.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        return feature.properties.LocationID;
      }
    }
    return null;
  }

  const handleMapClick = e => {
    const { lng, lat } = e.lngLat;
    const tz = getTaxiZoneFromPoint(lng, lat);
    if (choosingOrigin) {
      setOrigin(tz);
      setOriginCoords({ lat, lng });
    } else {
      setDestination(tz);
      setDestinationCoords({ lat, lng });
    }
  };

  const handleReset = () => {
    setOrigin(null);
    setOriginCoords(null);
    setDestination(null);
    setDestinationCoords(null);
    setChoosingOrigin(true);
    setShowModal(false);
    setWeatherData(null);
    setResults(null);
  };

  const handleConfirmDropoff = () => {
    setShowModal(true);
  };

  return (
    <>
      {user && (
        <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: '600' }}>
          Welcome, {user} 👋
        </div>
      )}
      {choosingOrigin ? (
        <div className="startMap">
          <p>Choose Pickup Location!</p>
          <hr />

          <div className="map-container">
            <div className="zone-badges">
              <div className="zone-badge origin">Pickup: {origin ?? '—'}</div>
              <div className="zone-badge dest">Dropoff: {destination ?? '—'}</div>
            </div>

            <button className="btn" onClick={() => navigate('/log')}>
              Log a Ride
            </button>

            <Map
              mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
              initialViewState={{
                longitude: -73.935242,
                latitude: 40.73061,
                zoom: 10
              }}
              mapStyle="mapbox://styles/mapbox/streets-v11"
              maxBounds={[
                [-74.25909, 40.477399],
                [-73.700181, 40.917576]
              ]}
              onClick={handleMapClick}
              className="map"
            />
          </div>

          <button className="reset-button" onClick={handleReset}>Reset</button>

          {origin != null && (
            <button className="confirm" onClick={() => setChoosingOrigin(false)}>
              Confirm Pickup Location!
            </button>
          )}
        </div>
      ) : (
        <div className="endMap">
          <div className="endMap-header">
            <p>Choose Dropoff Location!</p>
            {weatherData?.current && (
              <div className="weather-summary-inline">
                Current Weather:
                🌡️ {weatherData.current.main.temp}°C&nbsp;
                💨 {weatherData.current.wind.speed} m/s&nbsp;
                ☔ {weatherData.current.rain?.['1h'] ?? 0} mm
              </div>
            )}
          </div>
          <hr />

          <div className="map-container">
            <div className="zone-badges">
              <div className="zone-badge origin">Pickup: {origin ?? '—'}</div>
              <div className="zone-badge dest">Dropoff: {destination ?? '—'}</div>
            </div>

            <Map
              mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
              initialViewState={{
                longitude: -73.935242,
                latitude: 40.73061,
                zoom: 10
              }}
              mapStyle="mapbox://styles/mapbox/streets-v11"
              maxBounds={[
                [-74.25909, 40.477399],
                [-73.700181, 40.917576]
              ]}
              onClick={handleMapClick}
              className="map"
            />

            <button className="reset-button" onClick={handleReset}>Reset</button>
          </div>

          {destination != null && (
            <button className="confirm" onClick={handleConfirmDropoff}>
              Confirm Dropoff Location!
            </button>
          )}
        </div>
      )}

      {/* === Modal (metrics only) === */}
      {showModal && (
        <>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
          <div className="modal">
            <button className="close" onClick={() => setShowModal(false)}>×</button>
            <h2>Ride-Specific Metrics</h2>
            <div className="section">
              <button className="btn" onClick={queryRoute1}>Expected fare given weather conditions</button>
              <button className="btn" onClick={queryRoute2}>Expected fare given pickup and drop-off locations</button>
              <button className="btn" onClick={queryRoute3}>Expected ride time</button>
              <button className="btn" onClick={queryRoute4}>Top 5 most similar rides in database</button>
            </div>
            <h2>General Metrics</h2>
            <div className="section">
              <button className="btn" onClick={queryRoute5}>Hourly ride count for above-average fares</button>
              <button className="btn" onClick={queryRoute6}>Detailed ride analysis by extreme weather & location</button>
              <button className="btn" onClick={queryRoute7}>Rush hour vs. non-rush hour by pickup location</button>
              <button className="btn" onClick={queryRoute8}>Outlier rides based on fare and trip time</button>
              <button className="btn" onClick={queryRoute9}>Hourly user-aggregated ride stats by weather</button>
            </div>
          </div>
        </>
      )}

      {showResultsModal && (
        <div className="modal-backdrop" onClick={() => setShowResultsModal(false)} />
      )}
      {showResultsModal && (
        <div className="modal">
          <button className="close" onClick={() => setShowResultsModal(false)}>×</button>
          <h2>Query Results</h2>
          <pre style={{ overflowX: 'auto', maxHeight: '60vh' }}>{JSON.stringify(results, null, 2)}</pre>
        </div>
      )}
    </>
  );
}
