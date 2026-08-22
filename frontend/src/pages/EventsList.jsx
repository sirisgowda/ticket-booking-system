import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function EventsList() {
  const [events, setEvents] = useState([]);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, [type]);

  async function load() {
    const params = {};
    if (type) params.type = type;
    if (search) params.search = search;
    const { data } = await api.get('/events', { params });
    setEvents(data);
  }

  return (
    <div className="container">
      <h2>Browse Events</h2>
      <div className="card" style={{ display: 'flex', gap: 12 }}>
        <input placeholder="Search title..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="movie">Movies</option>
          <option value="concert">Concerts</option>
        </select>
        <button className="btn" onClick={load}>
          Search
        </button>
      </div>

      <div className="grid">
        {events.map((ev) => (
          <div className="card" key={ev.id}>
            <h3>{ev.title}</h3>
            <p style={{ opacity: 0.8 }}>{ev.description}</p>
            <span className="badge" style={{ background: '#1e3a8a' }}>
              {ev.type}
            </span>
            <div style={{ marginTop: 12 }}>
              <b>Shows:</b>
              <ul>
                {ev.Shows?.map((s) => (
                  <li key={s.id}>
                    {s.date} {s.time} @ {s.Venue?.name} - <Link to={`/shows/${s.id}`}>View seats & book</Link>
                  </li>
                ))}
                {ev.Shows?.length === 0 && <li>No shows scheduled yet</li>}
              </ul>
            </div>
          </div>
        ))}
        {events.length === 0 && <p>No events found.</p>}
      </div>
    </div>
  );
}
