import { useEffect, useState } from 'react';
import api from '../api/client';

export default function OrganiserDashboard() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [eventForm, setEventForm] = useState({ title: '', description: '', type: 'movie' });
  const [showForm, setShowForm] = useState({ eventId: '', venueId: '', date: '', time: '', premium: 500, standard: 250 });
  const [summary, setSummary] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadEvents();
    loadVenues();
  }, []);

  async function loadEvents() {
    const { data } = await api.get('/events');
    setEvents(data);
  }
  async function loadVenues() {
    const { data } = await api.get('/venues');
    setVenues(data);
  }

  async function createEvent(e) {
    e.preventDefault();
    await api.post('/events', eventForm);
    setEventForm({ title: '', description: '', type: 'movie' });
    setMsg('Event created.');
    loadEvents();
  }

  async function createShow(e) {
    e.preventDefault();
    try {
      await api.post(`/events/${showForm.eventId}/shows`, {
        venueId: showForm.venueId,
        date: showForm.date,
        time: showForm.time,
        pricing: { Premium: Number(showForm.premium), Standard: Number(showForm.standard) },
      });
      setMsg('Show scheduled.');
      loadEvents();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to create show');
    }
  }

  async function viewSummary(eventId) {
    const { data } = await api.get(`/events/${eventId}/summary`);
    setSummary(data);
  }

  return (
    <div className="container">
      <h2>Organiser Dashboard</h2>
      {msg && <p>{msg}</p>}

      <div className="card">
        <h3>Create Event</h3>
        <form onSubmit={createEvent}>
          <input
            placeholder="Title"
            value={eventForm.title}
            onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Description"
            value={eventForm.description}
            onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
          />
          <select value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}>
            <option value="movie">Movie</option>
            <option value="concert">Concert</option>
          </select>
          <button className="btn" type="submit">
            Create Event
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Schedule a Show</h3>
        <form onSubmit={createShow}>
          <select
            value={showForm.eventId}
            onChange={(e) => setShowForm({ ...showForm, eventId: e.target.value })}
            required
          >
            <option value="">Select your event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
          <select
            value={showForm.venueId}
            onChange={(e) => setShowForm({ ...showForm, venueId: e.target.value })}
            required
          >
            <option value="">Select venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <input type="date" value={showForm.date} onChange={(e) => setShowForm({ ...showForm, date: e.target.value })} required />
          <input
            type="time"
            value={showForm.time}
            onChange={(e) => setShowForm({ ...showForm, time: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Premium price"
            value={showForm.premium}
            onChange={(e) => setShowForm({ ...showForm, premium: e.target.value })}
          />
          <input
            type="number"
            placeholder="Standard price"
            value={showForm.standard}
            onChange={(e) => setShowForm({ ...showForm, standard: e.target.value })}
          />
          <button className="btn" type="submit">
            Schedule Show
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Your Events & Revenue</h3>
        {events.map((ev) => (
          <div key={ev.id} style={{ marginBottom: 8 }}>
            {ev.title} <button className="btn secondary" onClick={() => viewSummary(ev.id)}>View summary</button>
          </div>
        ))}
        {summary && (
          <div>
            <h4>{summary.title}</h4>
            <p>
              Total bookings: {summary.totalBookings} — Total revenue: ₹{summary.totalRevenue}
            </p>
            <ul>
              {summary.shows.map((s) => (
                <li key={s.showId}>
                  {s.date} {s.time}: {s.bookingsCount} bookings, ₹{s.revenue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
