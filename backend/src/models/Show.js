const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Show = sequelize.define('Show', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  time: { type: DataTypes.STRING, allowNull: false }, // "19:30"
  // pricing per seat category, e.g. { "Premium": 500, "Standard": 250 }
  pricing: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('pricing');
      return raw ? JSON.parse(raw) : {};
    },
    set(val) {
      this.setDataValue('pricing', JSON.stringify(val));
    },
  },
});

module.exports = Show;
