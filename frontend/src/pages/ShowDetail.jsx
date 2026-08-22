import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api/client';
import SeatMap from '../components/SeatMap';

export default function ShowDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [show, setShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [heldUntil, setHeldUntil] = useState(null);
  const [msg, setMsg] = useState('');
  const [booking, setBooking] = useState(null);
  const socketRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    load();
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    socket.emit('joinShow', id);
    socket.on('seatmap:update', () => load(true));
    socketRef.current = socket;

    // If arriving from a waitlist offer email link, pre-select that seat.
    const offeredSeat = searchParams.get('seat');
    if (offeredSeat) setSelected([offeredSeat]);

    return () => socket.disconnect();
  }, [id]);

  useEffect(() => {
    if (!heldUntil) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(heldUntil) - new Date()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0) {
        clearInterval(interval);
        setMsg('Your hold expired. Please reselect your seats.');
        setSelected([]);
        setHeldUntil(null);
        load();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [heldUntil]);

  async function load(silent) {
    const { data } = await api.get(`/shows/${id}/seats`);
    setShow(data.show);
    setSeats(data.seats);
  }

  function toggleSeat(seat) {
    setSelected((prev) =>
      prev.includes(seat.showSeatId) ? prev.filter((x) => x !== seat.showSeatId) : [...prev, seat.showSeatId]
    );
  }

  async function handleHold() {
    setMsg('');
    try {
      const { data } = await api.post(`/shows/${id}/hold`, { seatIds: selected });
      setHeldUntil(data.heldUntil);
      setMsg('Seats held! Complete checkout before the timer runs out.');
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to hold seats');
      load();
    }
  }

  async function handleCheckout() {
    setMsg('');
    try {
      const { data } = await api.post(`/bookings/${id}/checkout`, { seatIds: selected });
      setBooking(data);
      setSelected([]);
      setHeldUntil(null);
      setMsg('Booking confirmed! Check your email for the QR ticket.');
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Checkout failed');
    }
  }

  async function handleWaitlist(category) {
    try {
      await api.post(`/shows/${id}/waitlist`, { category });
      setMsg(`You've joined the waitlist for ${category} seats.`);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to join waitlist');
    }
  }

  if (!show) return <div className="container">Loading...</div>;

  const categories = [...new Set(seats.map((s) => s.category))];
  const soldOutCategories = categories.filter((c) => seats.filter((s) => s.category === c).every((s) => s.status !== 'available'));

  return (
    <div className="container">
      <h2>
        {show.Event?.title} — {show.date} {show.time}
      </h2>
      <p>{show.Venue?.name}</p>

      <div className="card">
        <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} />
      </div>

      {soldOutCategories.length > 0 && (
        <div className="card">
          <b>Sold out categories:</b>
          {soldOutCategories.map((c) => (
            <button key={c} className="btn secondary" style={{ marginLeft: 8 }} onClick={() => handleWaitlist(c)}>
              Join waitlist for {c}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <p>Selected: {selected.length} seat(s)</p>
        {secondsLeft !== null && (
          <p className="timer">
            Hold expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
        )}
        {msg && <p>{msg}</p>}
        {!heldUntil ? (
          <button className="btn" disabled={selected.length === 0} onClick={handleHold}>
            Hold selected seats
          </button>
        ) : (
          <button className="btn" onClick={handleCheckout}>
            Confirm & Pay (Checkout)
          </button>
        )}
      </div>

      {booking && (
        <div className="card">
          <h3>Booking confirmed 🎟️</h3>
          <p>Reference: {booking.reference}</p>
          <p>Total: ₹{booking.totalAmount}</p>
          {booking.qrCodeDataUrl && <img src={booking.qrCodeDataUrl} width={180} alt="QR ticket" />}
        </div>
      )}
    </div>
  );
}
