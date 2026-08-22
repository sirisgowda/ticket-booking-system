const sequelize = require('../config/db');
const User = require('./User');
const Venue = require('./Venue');
const Seat = require('./Seat');
const Event = require('./Event');
const Show = require('./Show');
const ShowSeat = require('./ShowSeat');
const Booking = require('./Booking');
const BookingSeat = require('./BookingSeat');
const Waitlist = require('./Waitlist');

// Venue <-> Seat (1 venue has many physical seats)
Venue.hasMany(Seat, { foreignKey: 'venueId', onDelete: 'CASCADE' });
Seat.belongsTo(Venue, { foreignKey: 'venueId' });

// Admin (User) creates Venue
User.hasMany(Venue, { foreignKey: 'createdById' });
Venue.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// Organiser (User) creates Event
User.hasMany(Event, { foreignKey: 'organiserId' });
Event.belongsTo(User, { as: 'organiser', foreignKey: 'organiserId' });

// Event has many Shows, each Show at one Venue
Event.hasMany(Show, { foreignKey: 'eventId', onDelete: 'CASCADE' });
Show.belongsTo(Event, { foreignKey: 'eventId' });
Venue.hasMany(Show, { foreignKey: 'venueId' });
Show.belongsTo(Venue, { foreignKey: 'venueId' });

// Show <-> Seat via ShowSeat (per-show seat status)
Show.hasMany(ShowSeat, { foreignKey: 'showId', onDelete: 'CASCADE' });
ShowSeat.belongsTo(Show, { foreignKey: 'showId' });
Seat.hasMany(ShowSeat, { foreignKey: 'seatId' });
ShowSeat.belongsTo(Seat, { foreignKey: 'seatId' });
User.hasMany(ShowSeat, { foreignKey: 'heldByUserId' });

// Booking
User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });
Show.hasMany(Booking, { foreignKey: 'showId' });
Booking.belongsTo(Show, { foreignKey: 'showId' });

Booking.hasMany(BookingSeat, { foreignKey: 'bookingId', onDelete: 'CASCADE' });
BookingSeat.belongsTo(Booking, { foreignKey: 'bookingId' });
ShowSeat.hasOne(BookingSeat, { foreignKey: 'showSeatId' });
BookingSeat.belongsTo(ShowSeat, { foreignKey: 'showSeatId' });

// Waitlist
User.hasMany(Waitlist, { foreignKey: 'userId' });
Waitlist.belongsTo(User, { foreignKey: 'userId' });
Show.hasMany(Waitlist, { foreignKey: 'showId', onDelete: 'CASCADE' });
Waitlist.belongsTo(Show, { foreignKey: 'showId' });

module.exports = {
  sequelize,
  User,
  Venue,
  Seat,
  Event,
  Show,
  ShowSeat,
  Booking,
  BookingSeat,
  Waitlist,
};
