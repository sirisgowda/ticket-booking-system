const { Waitlist, ShowSeat } = require('../models');
const { Op } = require('sequelize');

const OFFER_TTL_MS = (parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES, 10) || 15) * 60 * 1000;

async function joinWaitlist(showId, category, userId) {
  const existing = await Waitlist.findOne({ where: { showId, category, userId, status: ['waiting', 'offered'] } });
  if (existing) return existing;
  return Waitlist.create({ showId, category, userId, status: 'waiting' });
}

/**
 * Called right after a seat becomes free (cancellation) or a waitlist offer
 * expires unclaimed. Finds the oldest 'waiting' entry for that seat's
 * category on that show and offers them the seat with a TTL. Uses an
 * atomic conditional UPDATE on the Waitlist row so two concurrent
 * cancellations freeing two seats can't both offer to the same customer.
 */
async function offerSeatToNextInLine(showId, showSeat) {
  const category = showSeat.Seat ? showSeat.Seat.category : showSeat.category;

  const next = await Waitlist.findOne({
    where: { showId, category, status: 'waiting' },
    order: [['createdAt', 'ASC']],
  });
  if (!next) return null; // nobody waiting - seat just stays available

  const offerExpiresAt = new Date(Date.now() + OFFER_TTL_MS);

  const [affected] = await Waitlist.update(
    { status: 'offered', offeredSeatId: showSeat.id, offerExpiresAt },
    { where: { id: next.id, status: 'waiting' } }
  );
  if (affected === 0) return null; // someone else grabbed this waitlist entry - shouldn't happen, but safe

  // Hold the seat against this specific user so nobody else can grab it
  // while their offer window is open.
  await ShowSeat.update(
    { status: 'held', heldByUserId: next.userId, heldUntil: offerExpiresAt },
    { where: { id: showSeat.id, status: 'available' } }
  );

  const { sendWaitlistOfferEmail } = require('./emailService');
  sendWaitlistOfferEmail({ userId: next.userId, showId, showSeatId: showSeat.id, offerExpiresAt }).catch((e) =>
    console.error('Waitlist offer email failed:', e.message)
  );

  return next;
}

/**
 * Cron-driven: find waitlist offers whose TTL passed without the customer
 * completing checkout, expire them, and cascade the seat to the next
 * person in line.
 */
async function expireStaleOffers() {
  const now = new Date();
  const stale = await Waitlist.findAll({ where: { status: 'offered', offerExpiresAt: { [Op.lt]: now } } });

  for (const entry of stale) {
    const [affected] = await Waitlist.update(
      { status: 'expired' },
      { where: { id: entry.id, status: 'offered' } }
    );
    if (affected !== 1) continue;

    const seat = await ShowSeat.findByPk(entry.offeredSeatId, { include: [require('../models').Seat] });
    if (seat && seat.status === 'held' && seat.heldByUserId === entry.userId) {
      seat.status = 'available';
      seat.heldByUserId = null;
      seat.heldUntil = null;
      seat.version += 1;
      await seat.save();
      await offerSeatToNextInLine(entry.showId, seat); // cascade to next in line
      const { broadcastSeatUpdate } = require('./seatService');
      broadcastSeatUpdate(entry.showId);
    }
  }
  return stale.length;
}

module.exports = { joinWaitlist, offerSeatToNextInLine, expireStaleOffers };
