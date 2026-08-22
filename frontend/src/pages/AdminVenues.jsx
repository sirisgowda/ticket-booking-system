import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AdminVenues() {
  const [venues, setVenues] = useState([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [rows, setRows] = useState(3);
  const [seatsPerRow, setSeatsPerRow] = useState(8);
  const [premiumRows, setPremiumRows] = useState(1);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await api.get('/venues');
    setVenues(data);
  }

  async function createVenue(e) {
    e.preventDefault();
    const rowLetters = 'ABCDEFGHIJ'.slice(0, rows).split('');
    const seats = [];
    rowLetters.forEach((row, idx) => {
      for (let n = 1; n <= seatsPerRow; n++) {
        seats.push({ row, number: n, category: idx < premiumRows ? 'Premium' : 'Standard' });
      }
    });
    try {
      await api.post('/venues', { name, address, seats });
      setMsg(`Venue created with ${seats.length} seats.`);
      setName('');
      setAddress('');
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to create venue');
    }
  }

  return (
    <div className="container">
      <h2>Admin: Venue & Seat Layout Management</h2>
      {msg && <p>{msg}</p>}
      <div className="card">
        <h3>Create Venue</h3>
        <form onSubmit={createVenue}>
          <input placeholder="Venue name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <label>Rows</label>
          <input type="number" min="1" max="10" value={rows} onChange={(e) => setRows(Number(e.target.value))} />
          <label>Seats per row</label>
          <input type="number" min="1" max="30" value={seatsPerRow} onChange={(e) => setSeatsPerRow(Number(e.target.value))} />
          <label>Premium rows (from front, e.g. 1 = row A only)</label>
          <input type="number" min="0" value={premiumRows} onChange={(e) => setPremiumRows(Number(e.target.value))} />
          <button className="btn" type="submit">
            Create Venue + Seat Layout
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Existing Venues</h3>
        {venues.map((v) => (
          <div key={v.id} style={{ marginBottom: 8 }}>
            <b>{v.name}</b> — {v.Seats?.length || 0} seats — {v.address}
          </div>
        ))}
      </div>
    </div>
  );
}
