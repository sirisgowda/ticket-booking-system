const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Event = sequelize.define('Event', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  type: { type: DataTypes.ENUM('movie', 'concert'), allowNull: false, defaultValue: 'movie' },
  posterUrl: { type: DataTypes.STRING, allowNull: true },
});

module.exports = Event;
