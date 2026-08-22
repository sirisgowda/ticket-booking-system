const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A Seat is a fixed physical seat in a Venue's layout (row/col + category).
// Availability is NOT stored here - it's per-Show, in ShowSeat.
const Seat = sequelize.define('Seat', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  row: { type: DataTypes.STRING, allowNull: false },
  number: { type: DataTypes.INTEGER, allowNull: false },
  label: { type: DataTypes.STRING, allowNull: false }, // e.g. "A1"
  category: { type: DataTypes.STRING, allowNull: false }, // e.g. Premium, Standard
});

module.exports = Seat;
