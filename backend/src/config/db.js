const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// SQLite is used for zero-setup local/dev running & grading.
// For production concurrency at scale, point this at Postgres instead:
//   new Sequelize(process.env.DATABASE_URL, { dialect: 'postgres' })
// The seat-hold/booking logic uses atomic conditional UPDATEs (see
// services/seatService.js) which work identically on both engines.
const storage = process.env.DATABASE_STORAGE || path.join(__dirname, '../../data/database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: false,
});

module.exports = sequelize;
