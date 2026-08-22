import { useEffect, useState } from 'react';
import api from '../api/client';

export default function BookingHistory() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await api.get('/bookings/me');
    setBookings(data);
  }

  async function cancel(id) {
    if (!confirm('Cancel this booking?')) return;
    await api.post(`/bookings/${id}/cancel`);
    load();
  }

  return (
    <div className="container">
      <h2>My Bookings</h2>
      {bookings.map((b) => (
        <div className="card" key={b.id}>
          <h3>
            {b.Show?.Event?.title} <span className={`badge ${b.status}`}>{b.status}</span>
          </h3>
          <p>
            {b.Show?.date} {b.Show?.time} @ {b.Show?.Venue?.name}
          </p>
          <p>
            Reference: {b.reference} — Total: ₹{b.totalAmount}
          </p>
          <p>Seats: {b.BookingSeats?.map((bs) => bs.ShowSeat?.Seat?.label).join(', ')}</p>
          {b.qrCodeDataUrl && <img src={b.qrCodeDataUrl} width={120} alt="QR ticket" />}
          {b.status === 'confirmed' && (
            <div>
              <button className="btn danger" onClick={() => cancel(b.id)}>
                Cancel booking
              </button>
            </div>
          )}
        </div>
      ))}
      {bookings.length === 0 && <p>No bookings yet.</p>}
    </div>
  );
}
