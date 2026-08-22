const router = require('express').Router();
const { Booking, BookingSeat, ShowSeat, Seat, Show, Event, Venue } = require('../models');
const { authenticate } = require('../middleware/auth');
const seatService = require('../services/seatService');

// Confirm booking for currently-held seats
router.post('/:showId/checkout', authenticate, async (req, res) => {
  try {
    const { seatIds } = req.body;
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'seatIds[] required' });
    }
    const booking = await seatService.confirmBooking(req.params.showId, seatIds, req.user.id);
    res.status(201).json(booking);
  } catch (err) {
    if (err.code === 'HOLD_EXPIRED') return res.status(409).json({ error: err.message });
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Booking history
router.get('/me', authenticate, async (req, res) => {
  const bookings = await Booking.findAll({
    where: { userId: req.user.id },
    include: [
      { model: Show, include: [Event, Venue] },
      { model: BookingSeat, include: [{ model: ShowSeat, include: [Seat] }] },
    ],
    order: [['createdAt', 'DESC']],
  });
  res.json(bookings);
});

// Cancel a booking
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const booking = await seatService.cancelBooking(req.params.id, req.user.id);
    res.json(booking);
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'ALREADY_CANCELLED') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
