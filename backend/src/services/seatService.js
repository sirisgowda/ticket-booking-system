const { sequelize, ShowSeat, Booking, BookingSeat, Show, Seat } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { generateQrCode } = require('./qrService');
const { sendBookingEmail, sendWaitlistOfferEmail } = require('./emailService');
const { getIO } = require('./socketService');
const waitlistService = require('./waitlistService');

const HOLD_TTL_MS = (parseInt(process.env.SEAT_HOLD_TTL_MINUTES, 10) || 10) * 60 * 1000;

/**
 * Attempt to place a hold on a set of seats for a show.
 *
 * Concurrency protection: instead of "read status, then write", each seat
 * is claimed with a single atomic conditional UPDATE:
 *
 *   UPDATE ShowSeats SET status='held', heldByUserId=?, heldUntil=?, version=version+1
 *   WHERE id=? AND status='available'
 *
 * Sequelize's `update(..., { where })` compiles to exactly this. The DB
 * engine (SQLite/Postgres alike) executes each UPDATE atomically, so if two
 * requests race for the same seat, only one UPDATE affects a row (rowCount
 * = 1); the loser gets rowCount = 0 and is told the seat is unavailable.
 * No explicit row lock or transaction retry loop is needed because the
 * "check + change" happens in one indivisible statement.
 */
async function holdSeats(showId, seatIds, userId) {
  const heldUntil = new Date(Date.now() + HOLD_TTL_MS);
  const successfulIds = [];
  const failedIds = [];

  for (const showSeatId of seatIds) {
    const [affectedRows] = await ShowSeat.update(
      { status: 'held', heldByUserId: userId, heldUntil, version: sequelize.literal('version + 1') },
      { where: { id: showSeatId, showId, status: 'available' } }
    );
    if (affectedRows === 1) {
      successfulIds.push(showSeatId);
    } else {
      failedIds.push(showSeatId);
    }
  }

  if (failedIds.length > 0) {
    // Roll back any seats we DID manage to hold in this request, since a
    // partial hold is confusing for the customer - all-or-nothing.
    if (successfulIds.length > 0) {
      await ShowSeat.update(
        { status: 'available', heldByUserId: null, heldUntil: null },
        { where: { id: successfulIds, heldByUserId: userId } }
      );
    }
    const err = new Error('One or more selected seats are no longer available');
    err.code = 'SEATS_UNAVAILABLE';
    err.failedIds = failedIds;
    throw err;
  }

  broadcastSeatUpdate(showId);
  return { heldSeatIds: successfulIds, heldUntil };
}

/** Explicit release, e.g. user navigates away / cancels checkout. */
async function releaseHold(showId, seatIds, userId) {
  const [affected] = await ShowSeat.update(
    { status: 'available', heldByUserId: null, heldUntil: null },
    { where: { id: seatIds, showId, heldByUserId: userId, status: 'held' } }
  );
  broadcastSeatUpdate(showId);
  return affected;
}

/**
 * Background job entry point: find all holds whose TTL has passed and
 * auto-release them. Called by the node-cron job in jobs/expireHolds.js.
 */
async function releaseExpiredHolds() {
  const now = new Date();
  const expired = await ShowSeat.findAll({ where: { status: 'held', heldUntil: { [Op.lt]: now } } });
  if (expired.length === 0) return 0;

  const byShow = {};
  for (const seat of expired) {
    // Atomic conditional release, guards against a customer completing
    // checkout in the exact instant the cron fires.
    const [affected] = await ShowSeat.update(
      { status: 'available', heldByUserId: null, heldUntil: null },
      { where: { id: seat.id, status: 'held', heldUntil: { [Op.lt]: now } } }
    );
    if (affected === 1) {
      byShow[seat.showId] = true;
    }
  }
  Object.keys(byShow).forEach(broadcastSeatUpdate);
  return expired.length;
}

/**
 * Confirm a booking for seats the user currently holds. Verifies the hold
 * is still theirs and unexpired, then atomically flips held -> booked.
 */
async function confirmBooking(showId, seatIds, userId) {
  const t = await sequelize.transaction();
  try {
    const now = new Date();
    const seats = await ShowSeat.findAll({
      where: { id: seatIds, showId },
      include: [{ model: Seat }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (seats.length !== seatIds.length) throw Object.assign(new Error('Seat not found'), { code: 'NOT_FOUND' });

    for (const s of seats) {
      if (s.status !== 'held' || s.heldByUserId !== userId || new Date(s.heldUntil) < now) {
        throw Object.assign(new Error('Your hold on one or more seats has expired'), { code: 'HOLD_EXPIRED' });
      }
    }

    const show = await Show.findByPk(showId, { transaction: t });
    const pricing = show.pricing;
    let total = 0;
    const seatPrices = seats.map((s) => {
      const price = pricing[s.Seat.category] || 0;
      total += price;
      return { showSeatId: s.id, price };
    });

    for (const s of seats) {
      s.status = 'booked';
      s.heldByUserId = null;
      s.heldUntil = null;
      s.version += 1;
      await s.save({ transaction: t });
    }

    const reference = 'BK-' + uuidv4().split('-')[0].toUpperCase();
    const booking = await Booking.create(
      { reference, userId, showId, totalAmount: total, status: 'confirmed' },
      { transaction: t }
    );

    for (const sp of seatPrices) {
      await BookingSeat.create(
        { bookingId: booking.id, showSeatId: sp.showSeatId, price: sp.price },
        { transaction: t }
      );
    }

    await t.commit();

    broadcastSeatUpdate(showId);

    // QR + email happen after commit so a slow SMTP call never holds the DB transaction open.
    const qrDataUrl = await generateQrCode(reference);
    booking.qrCodeDataUrl = qrDataUrl;
    await booking.save();
    sendBookingEmail({ userId, booking, showId }).catch((e) => console.error('Email send failed:', e.message));

    return booking;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Cancel a confirmed booking. Frees the seats, then offers each freed seat
 * to the next waiting customer in that category's waitlist queue.
 */
async function cancelBooking(bookingId, userId) {
  const booking = await Booking.findOne({ where: { id: bookingId, userId }, include: [BookingSeat] });
  if (!booking) throw Object.assign(new Error('Booking not found'), { code: 'NOT_FOUND' });
  if (booking.status === 'cancelled') throw Object.assign(new Error('Already cancelled'), { code: 'ALREADY_CANCELLED' });

  booking.status = 'cancelled';
  await booking.save();

  const showSeatIds = booking.BookingSeats.map((bs) => bs.showSeatId);
  const seats = await ShowSeat.findAll({ where: { id: showSeatIds }, include: [Seat] });

  for (const seat of seats) {
    seat.status = 'available';
    seat.version += 1;
    await seat.save();
    // Try to hand this exact freed seat to the next waitlisted customer.
    await waitlistService.offerSeatToNextInLine(booking.showId, seat);
  }

  broadcastSeatUpdate(booking.showId);
  return booking;
}

function broadcastSeatUpdate(showId) {
  const io = getIO();
  if (io) io.to(`show:${showId}`).emit('seatmap:update', { showId });
}

module.exports = {
  holdSeats,
  releaseHold,
  releaseExpiredHolds,
  confirmBooking,
  cancelBooking,
  broadcastSeatUpdate,
  HOLD_TTL_MS,
};
