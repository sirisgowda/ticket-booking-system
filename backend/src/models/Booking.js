const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Booking = sequelize.define('Booking', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reference: { type: DataTypes.STRING, allowNull: false, unique: true },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled'),
    allowNull: false,
    defaultValue: 'confirmed',
  },
  totalAmount: { type: DataTypes.FLOAT, allowNull: false },
  qrCodeDataUrl: { type: DataTypes.TEXT, allowNull: true },
});

module.exports = Booking;
