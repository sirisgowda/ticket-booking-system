const router = require('express').Router();
const { Show, ShowSeat, Seat, Event, Venue } = require('../models');
const { authenticate } = require('../middleware/auth');
const seatService = require('../services/seatService');
const waitlistService = require('../services/waitlistService');

// Visual seat map for a show, with real-time status per seat.
router.get('/:id/seats', authenticate, async (req, res) => {
  const show = await Show.findByPk(req.params.id, { include: [Event, Venue] });
  if (!show) return res.status(404).json({ error: 'Show not found' });

  const showSeats = await ShowSeat.findAll({ where: { showId: show.id }, include: [Seat] });

  const seatMap = showSeats.map((ss) => ({
    showSeatId: ss.id,
    row: ss.Seat.row,
    number: ss.Seat.number,
    label: ss.Seat.label,
    category: ss.Seat.category,
    price: show.pricing[ss.Seat.category] || 0,
    status: ss.status,
    // "mine" lets the frontend show a hold as "yours" vs "unavailable"
    mine: ss.heldByUserId === req.user.id,
    heldUntil: ss.heldUntil,
  }));

  res.json({ show, seats: seatMap });
});

// Hold seats (start of checkout)
router.post('/:id/hold', authenticate, async (req, res) => {
  try {
    const { seatIds } = req.body;
    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'seatIds[] required' });
    }
    const result = await seatService.holdSeats(req.params.id, seatIds, req.user.id);
    res.json(result);
  } catch (err) {
    if (err.code === 'SEATS_UNAVAILABLE') {
      return res.status(409).json({ error: err.message, failedIds: err.failedIds });
    }
    res.status(500).json({ error: err.message });
  }
});

// Explicit release (user backs out of checkout)
router.post('/:id/release', authenticate, async (req, res) => {
  try {
    const { seatIds } = req.body;
    const affected = await seatService.releaseHold(req.params.id, seatIds, req.user.id);
    res.json({ released: affected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join waitlist for a sold-out category
router.post('/:id/waitlist', authenticate, async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) return res.status(400).json({ error: 'category required' });
    const entry = await waitlistService.joinWaitlist(req.params.id, category, req.user.id);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
