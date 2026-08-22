const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// One row per (Show, Seat). This is where real-time status lives.
// status transitions: available -> held -> booked
//                      held -> available (TTL expiry or explicit release)
//                      booked -> available (cancellation, seat re-offered via waitlist)
const ShowSeat = sequelize.define('ShowSeat', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  status: {
    type: DataTypes.ENUM('available', 'held', 'booked'),
    allowNull: false,
    defaultValue: 'available',
  },
  heldByUserId: { type: DataTypes.UUID, allowNull: true },
  heldUntil: { type: DataTypes.DATE, allowNull: true },
  // Optimistic-lock style version counter, bumped on every atomic transition.
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = ShowSeat;
