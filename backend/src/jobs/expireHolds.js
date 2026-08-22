const cron = require('node-cron');
const seatService = require('../services/seatService');
const waitlistService = require('../services/waitlistService');

function startExpiryJob() {
  const schedule = process.env.HOLD_EXPIRY_CRON || '*/30 * * * * *'; // every 30s by default
  cron.schedule(schedule, async () => {
    try {
      const releasedCount = await seatService.releaseExpiredHolds();
      const expiredOffers = await waitlistService.expireStaleOffers();
      if (releasedCount || expiredOffers) {
        console.log(`[cron] released ${releasedCount} expired hold(s), ${expiredOffers} stale waitlist offer(s)`);
      }
    } catch (err) {
      console.error('[cron] expiry job error:', err.message);
    }
  });
  console.log(`[cron] hold/waitlist expiry job scheduled: ${schedule}`);
}

module.exports = { startExpiryJob };
