const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Links a Booking to the ShowSeats it covers, with the price locked at
// time of booking (so later price changes don't affect past bookings).
const BookingSeat = sequelize.define('BookingSeat', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  price: { type: DataTypes.FLOAT, allowNull: false },
});

module.exports = BookingSeat;
