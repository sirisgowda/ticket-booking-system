const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Venue = sequelize.define('Venue', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: true },
});

module.exports = Venue;
