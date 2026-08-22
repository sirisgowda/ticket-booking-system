# Ticket Booking System

A full-stack ticket booking platform for movies & concerts: visual seat maps,
TTL-based seat holds with auto-release, concurrency-safe booking, waitlists
with automatic seat reassignment, and QR-code email tickets.

**Stack:** Node.js/Express + Sequelize (SQLite) backend, React (Vite) frontend,
Socket.io for real-time seat map updates, node-cron for hold/offer expiry,
`qrcode` + `nodemailer` for tickets.

---

## 1. Setup Guide

### Prerequisites
- Node.js 18+
- npm

### Backend

```bash
cd backend
cp .env.example .env      # edit values, especially SMTP + JWT_SECRET
npm install
npm run seed               # optional: creates demo admin/organiser/customer + a sample show
npm run dev                 # http://localhost:5000
```

The demo seed prints login credentials to the console (all use password
`password123`): `admin@example.com`, `organiser@example.com`,
`customer@example.com`.

For email, the quickest option is a free [Ethereal](https://ethereal.email)
inbox — create one, drop the generated user/pass into `.env`, and every
"sent" email is viewable at ethereal.email (nothing hits a real inbox). For
real delivery, use a Gmail account with an
[App Password](https://myaccount.google.com/apppasswords).

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Register as a **customer** or **organiser** from the UI, or log in with a
seeded account. Admin accounts are not self-registrable — use the seeded
admin login to create venues.

### Typical demo flow
1. Log in as **admin** → create a Venue with a seat layout.
2. Log in as **organiser** → create an Event, then schedule a Show at that
   venue with pricing per category.
3. Log in as **customer** → browse events, open a show, click seats, hold
   them, checkout. Check the Ethereal inbox for the QR ticket email.
4. Open the same show in a second browser (or incognito) as another
   customer to see real-time seat updates and try to grab a held seat.

---

## 2. Database Schema

| Table | Purpose |
|---|---|
| `Users` | customer / organiser / admin, bcrypt password hash |
| `Venues` | physical venue, created by admin |
| `Seats` | fixed seat layout per venue (row, number, category) |
| `Events` | movie/concert listing, owned by an organiser |
| `Shows` | a specific date/time + venue for an Event, with per-category pricing (JSON) |
| `ShowSeats` | **per-show** status of every seat: `available` / `held` / `booked`, `heldByUserId`, `heldUntil`, `version` |
| `Bookings` | a confirmed (or cancelled) purchase, with reference code, total, QR data URL |
| `BookingSeats` | join table: which `ShowSeats` belong to a `Booking`, at what locked-in price |
| `Waitlist` | queue entries per (Show, category, user): `waiting` / `offered` / `expired` / `fulfilled` |

Seats are modeled in two layers deliberately: `Seat` is the venue's fixed
physical layout (reusable across many shows at that venue), while
`ShowSeat` is the mutable, per-show availability row. This is what lets the
same physical seat be "available" for one showtime and "booked" for another.

---

## 3. Seat Hold, TTL & Concurrency

**The core problem:** two customers click the same seat within milliseconds
of each other. Only one may succeed.

Instead of "read status → check → write" (which has a race window),
every hold/booking/release is a single **atomic conditional UPDATE**:

```sql
UPDATE ShowSeats
SET status = 'held', heldByUserId = ?, heldUntil = ?, version = version + 1
WHERE id = ? AND status = 'available'
```

The database executes this as one indivisible operation. If two requests
race for the same seat, the DB serializes the two UPDATEs; only the first
one finds `status = 'available'` and affects a row. The second UPDATE
affects **zero rows**, and the backend (`seatService.holdSeats`) checks the
affected-row count to know it lost the race and reports the seat as taken.
No explicit locks, retry loops, or transactions are needed for the hold
step itself — the same technique protects release and waitlist-offer
transitions. `confirmBooking` additionally wraps the hold→booked transition
in a DB transaction with a row lock, since it also has to read pricing and
write multiple related rows atomically.

Each hold carries a `heldUntil` timestamp (`SEAT_HOLD_TTL_MINUTES` in
`.env`, default 10 minutes). A `node-cron` job (`jobs/expireHolds.js`,
every 30s) sweeps for `held` seats whose TTL has passed and releases them
back to `available` with the same atomic conditional UPDATE (guarding
against a customer completing checkout in the exact instant the sweep
runs). Every release/hold/booking change broadcasts a `seatmap:update`
event over Socket.io to everyone viewing that show, so seat maps update
live without polling.

---

## 4. Waitlist & Time-Limited Offer Flow

When every seat in a category is `held` or `booked`, the frontend shows a
**"Join waitlist"** button for that category, creating a `Waitlist` row
(`status: waiting`) ordered by `createdAt` (FIFO).

When a booking is cancelled (`seatService.cancelBooking`), the freed seat
is immediately passed to `waitlistService.offerSeatToNextInLine`, which:

1. Finds the oldest `waiting` entry for that show+category.
2. Atomically flips it to `offered` (conditional UPDATE — protects against
   two seats freeing at once and double-offering the same person).
3. Re-holds the specific seat against that user, with `heldUntil` set to
   `WAITLIST_OFFER_TTL_MINUTES` from now (default 15 minutes).
4. Emails them a direct link to `/shows/:id/checkout?seat=...` to complete
   the booking.

If the offer window lapses without checkout, the same cron job that
expires ordinary holds also calls `waitlistService.expireStaleOffers()`,
which marks the offer `expired`, releases the seat, and **cascades** it to
the next `waiting` entry in the queue — repeating until someone claims it
or the queue empties.

---

## 5. API Overview

All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | any | create account (customer/organiser) |
| POST | `/api/auth/login` | any | get JWT |
| POST | `/api/venues` | admin | create venue + seat layout |
| GET | `/api/venues` | any | list venues |
| POST | `/api/venues/:id/seats` | admin | add seats to a venue |
| POST | `/api/events` | organiser | create event |
| GET | `/api/events?type=&search=` | any | browse/filter events |
| POST | `/api/events/:id/shows` | organiser | schedule a show + pricing |
| GET | `/api/events/:id/summary` | organiser | bookings + revenue per show |
| GET | `/api/shows/:id/seats` | any | seat map with live status |
| POST | `/api/shows/:id/hold` | any | hold seats `{ seatIds }` |
| POST | `/api/shows/:id/release` | any | release a hold |
| POST | `/api/shows/:id/waitlist` | any | join waitlist `{ category }` |
| POST | `/api/bookings/:showId/checkout` | any | confirm booking for held seats |
| GET | `/api/bookings/me` | customer | booking history |
| POST | `/api/bookings/:id/cancel` | customer | cancel + trigger waitlist offer |

Socket.io event: client emits `joinShow(showId)`; server emits
`seatmap:update({ showId })` on any status change for that show.

---

## 6. Deploying

- **Backend**: Render/Railway — set the env vars from `.env.example`,
  build command `npm install`, start command `npm start`. SQLite works for
  a demo deploy (file persists on disk); for real production, swap
  `src/config/db.js` to Postgres (see comment in that file) since most
  free hosts have ephemeral disks.
- **Frontend**: Vercel/Render static site — build command `npm run build`,
  output dir `dist`, set `VITE_API_URL`/`VITE_SOCKET_URL` to the deployed
  backend URL.

See `SYSTEM_DESIGN.md` for the concurrency/TTL/waitlist design write-up.
