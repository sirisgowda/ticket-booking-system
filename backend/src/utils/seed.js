require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Venue, Seat, Event, Show, ShowSeat } = require('../models');

async function seed() {
  await sequelize.sync({ force: true }); // WARNING: wipes existing data - dev/demo only

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await User.create({ name: 'Admin User', email: 'admin@example.com', passwordHash, role: 'admin' });
  const organiser = await User.create({ name: 'Org Owner', email: 'organiser@example.com', passwordHash, role: 'organiser' });
  const customer = await User.create({ name: 'Jane Customer', email: 'customer@example.com', passwordHash, role: 'customer' });

  const venue = await Venue.create({ name: 'Grand Cinema Hall 1', address: '123 Main St', createdById: admin.id });

  const seatRows = [];
  const rows = ['A', 'B', 'C', 'D'];
  rows.forEach((row, rowIdx) => {
    for (let n = 1; n <= 8; n++) {
      seatRows.push({
        venueId: venue.id,
        row,
        number: n,
        label: `${row}${n}`,
        category: rowIdx < 1 ? 'Premium' : 'Standard',
      });
    }
  });
  const seats = await Seat.bulkCreate(seatRows);

  const event = await Event.create({
    title: 'Inception - 15th Anniversary Re-release',
    description: 'Christopher Nolan\'s mind-bending classic, back on the big screen.',
    type: 'movie',
    organiserId: organiser.id,
  });

  const show = await Show.create({
    eventId: event.id,
    venueId: venue.id,
    date: '2026-09-01',
    time: '19:30',
    pricing: { Premium: 500, Standard: 250 },
  });

  await ShowSeat.bulkCreate(seats.map((s) => ({ showId: show.id, seatId: s.id, status: 'available' })));

  console.log('Seed complete.');
  console.log('Admin login:      admin@example.com / password123');
  console.log('Organiser login:  organiser@example.com / password123');
  console.log('Customer login:   customer@example.com / password123');
  console.log(`Show ID: ${show.id}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
