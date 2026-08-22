const router = require('express').Router();
const { Venue, Seat } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

// Public: list venues (organisers need this to create shows)
router.get('/', authenticate, async (req, res) => {
  const venues = await Venue.findAll({ include: [Seat] });
  res.json(venues);
});

router.get('/:id', authenticate, async (req, res) => {
  const venue = await Venue.findByPk(req.params.id, { include: [Seat] });
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  res.json(venue);
});

// Admin only: create venue with seat layout
// body: { name, address, seats: [{ row, number, category }] }
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, address, seats } = req.body;
    if (!name || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ error: 'name and non-empty seats[] required' });
    }
    const venue = await Venue.create({ name, address, createdById: req.user.id });
    const seatRows = seats.map((s) => ({
      venueId: venue.id,
      row: s.row,
      number: s.number,
      label: `${s.row}${s.number}`,
      category: s.category,
    }));
    await Seat.bulkCreate(seatRows);
    const full = await Venue.findByPk(venue.id, { include: [Seat] });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin only: add more seats to an existing venue
router.post('/:id/seats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { seats } = req.body;
    const venue = await Venue.findByPk(req.params.id);
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    const seatRows = seats.map((s) => ({
      venueId: venue.id,
      row: s.row,
      number: s.number,
      label: `${s.row}${s.number}`,
      category: s.category,
    }));
    const created = await Seat.bulkCreate(seatRows);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
