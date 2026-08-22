const router = require('express').Router();
const { Event, Show, Venue, User } = require('../models');
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');

// Public/customer: browse & filter events
// query params: ?type=movie|concert&search=text
router.get('/', authenticate, async (req, res) => {
  const { type, search } = req.query;
  const where = {};
  if (type) where.type = type;
  if (search) where.title = { [Op.like]: `%${search}%` };

  const events = await Event.findAll({
    where,
    include: [{ model: Show, include: [Venue] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(events);
});

router.get('/:id', authenticate, async (req, res) => {
  const event = await Event.findByPk(req.params.id, { include: [{ model: Show, include: [Venue] }] });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

// Organiser only: create an event
router.post('/', authenticate, authorize('organiser'), async (req, res) => {
  try {
    const { title, description, type, posterUrl } = req.body;
    const event = await Event.create({ title, description, type, posterUrl, organiserId: req.user.id });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Organiser only: create a show (date/time/venue/pricing) under their event
router.post('/:id/shows', authenticate, authorize('organiser'), async (req, res) => {
  try {
    const event = await Event.findOne({ where: { id: req.params.id, organiserId: req.user.id } });
    if (!event) return res.status(404).json({ error: 'Event not found or not yours' });

    const { venueId, date, time, pricing } = req.body;
    const venue = await Venue.findByPk(venueId, { include: [require('../models').Seat] });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    const show = await Show.create({ eventId: event.id, venueId, date, time, pricing });

    // Materialize a ShowSeat row per physical seat in the venue, all 'available'.
    const { ShowSeat } = require('../models');
    const showSeatRows = venue.Seats.map((seat) => ({ showId: show.id, seatId: seat.id, status: 'available' }));
    await ShowSeat.bulkCreate(showSeatRows);

    res.status(201).json(show);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Organiser only: booking summary + revenue for one of their events
router.get('/:id/summary', authenticate, authorize('organiser'), async (req, res) => {
  const { Booking, BookingSeat } = require('../models');
  const event = await Event.findOne({
    where: { id: req.params.id, organiserId: req.user.id },
    include: [{ model: Show, include: [{ model: Booking, where: { status: 'confirmed' }, required: false }] }],
  });
  if (!event) return res.status(404).json({ error: 'Event not found or not yours' });

  const summary = event.Shows.map((show) => ({
    showId: show.id,
    date: show.date,
    time: show.time,
    bookingsCount: show.Bookings.length,
    revenue: show.Bookings.reduce((sum, b) => sum + b.totalAmount, 0),
  }));

  res.json({
    eventId: event.id,
    title: event.title,
    totalRevenue: summary.reduce((s, x) => s + x.revenue, 0),
    totalBookings: summary.reduce((s, x) => s + x.bookingsCount, 0),
    shows: summary,
  });
});

module.exports = router;
