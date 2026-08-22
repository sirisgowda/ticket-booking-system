const nodemailer = require('nodemailer');
const { User, Show, Event, Venue } = require('../models');

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendBookingEmail({ userId, booking, showId }) {
  const user = await User.findByPk(userId);
  const show = await Show.findByPk(showId, { include: [Event, Venue] });

  const base64 = booking.qrCodeDataUrl.split(',')[1];

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `Booking Confirmed - ${show.Event.title} (${booking.reference})`,
    html: `
      <h2>Booking confirmed 🎟️</h2>
      <p>Hi ${user.name}, your booking for <b>${show.Event.title}</b> at ${show.Venue.name}
      on ${show.date} ${show.time} is confirmed.</p>
      <p><b>Reference:</b> ${booking.reference}<br/>
      <b>Amount:</b> ${booking.totalAmount}</p>
      <p>Show this QR code at entry:</p>
      <img src="cid:qrcode" width="220" height="220" />
    `,
    attachments: [{ filename: 'ticket-qr.png', content: base64, encoding: 'base64', cid: 'qrcode' }],
  });
}

async function sendWaitlistOfferEmail({ userId, showId, showSeatId, offerExpiresAt }) {
  const user = await User.findByPk(userId);
  const show = await Show.findByPk(showId, { include: [Event] });
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `A seat opened up for ${show.Event.title}!`,
    html: `
      <h2>Good news - a seat is available</h2>
      <p>Hi ${user.name}, a seat you waitlisted for <b>${show.Event.title}</b> is now being held for you.</p>
      <p>Complete your booking within the time limit or it will be offered to the next person:</p>
      <p><a href="${clientUrl}/shows/${showId}/checkout?seat=${showSeatId}">Complete booking</a></p>
      <p>Offer expires at: ${new Date(offerExpiresAt).toLocaleString()}</p>
    `,
  });
}

module.exports = { sendBookingEmail, sendWaitlistOfferEmail };
