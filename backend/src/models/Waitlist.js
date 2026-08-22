const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A queue entry per (Show, category, user). FIFO by createdAt.
const Waitlist = sequelize.define('Waitlist', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  category: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('waiting', 'offered', 'expired', 'fulfilled', 'cancelled'),
    allowNull: false,
    defaultValue: 'waiting',
  },
  offeredSeatId: { type: DataTypes.UUID, allowNull: true }, // ShowSeat.id currently offered
  offerExpiresAt: { type: DataTypes.DATE, allowNull: true },
});

module.exports = Waitlist;
