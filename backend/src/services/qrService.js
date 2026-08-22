const QRCode = require('qrcode');

/** Encodes the booking reference into a QR code as a base64 data URL. */
async function generateQrCode(bookingReference) {
  return QRCode.toDataURL(bookingReference, { errorCorrectionLevel: 'M', width: 300 });
}

module.exports = { generateQrCode };
