# System Design Write-up

## Seat Hold & TTL Mechanism

Every seat's live availability lives in a `ShowSeat` row (one per
Show × Seat), separate from the venue's fixed physical `Seat` layout. This
separation lets the same physical seat be simultaneously bookable for
Tuesday's show and sold out for Friday's, without duplicating layout data.

A `ShowSeat` has three states: `available`, `held`, `booked`. Selecting
seats does not book them directly — it places a **hold**: the row is
updated to `status='held'`, `heldByUserId=<customer>`, and
`heldUntil=now()+TTL` (configurable, default 10 minutes). While held, the
seat map shows the seat as unavailable to every other customer, but not yet
consumed — this models real-world "seat locked during checkout" behavior
and prevents cart-abandonment from starving other buyers indefinitely.

Expiry is enforced by a `node-cron` job running every 30 seconds
(`jobs/expireHolds.js`), which finds all `held` rows past their `heldUntil`
and releases them back to `available`. This is a pull-based sweep rather
than a per-seat timer/callback, which keeps the design simple and stateless
— the job can run on any server instance and needs no in-memory timer
bookkeeping, so it survives server restarts cleanly (a seat's true state is
always just "what's in the row," recoverable from the DB alone). The
30-second granularity is an acceptable trade-off against the 10-minute TTL;
it can be tightened by adjusting `HOLD_EXPIRY_CRON`. Every hold, release,
booking, and expiry event broadcasts a Socket.io `seatmap:update` message
scoped to that show's room, so all connected clients see the seat map
change live without polling.

## Concurrency Prevention

The central risk is two customers selecting the same seat within
milliseconds. A naive "read status, then write if free" approach has a race
window between the read and the write where both requests can pass the
check. This system avoids that window entirely by never separating the
check from the write: every state transition is a single atomic
conditional UPDATE, e.g.

```sql
UPDATE ShowSeats SET status='held', heldByUserId=?, heldUntil=?
WHERE id=? AND status='available'
```

The database itself serializes concurrent writes to the same row, so if
two hold requests race, exactly one UPDATE matches the `WHERE` clause and
affects a row; the other affects zero rows. The application layer doesn't
need to lock anything explicitly — it simply checks the affected-row count
returned by the UPDATE. A count of 0 means "you lost the race," and the
customer is told that seat is no longer available and asked to reselect.
This pattern is used identically for holding, releasing, expiring, and
offering seats to waitlisted customers, so there's exactly one concurrency
strategy to reason about across the whole system. Multi-seat holds are
made all-or-nothing: if any seat in a request fails to lock, the seats that
did succeed are rolled back in the same request, so a customer never ends
up with a partial, confusing hold.

The one place a full DB transaction (with a row lock) is used rather than a
bare conditional UPDATE is `confirmBooking`, because completing a booking
also reads current pricing and writes several related rows (the seats, the
`Booking`, and multiple `BookingSeat` join rows) that must all commit
together or not at all. The hold→booked transition itself is still guarded
by re-checking that the seat is still held by the requesting user and
unexpired before flipping it, so a hold that expired a second earlier
cannot be silently honored.

## Waitlist Auto-Assignment & Time-Limited Offers

When a category is fully held/booked, customers can join a `Waitlist`
queue (FIFO by `createdAt`, scoped to a show + category). Waitlisting
itself does not reserve a seat — it's a request to be notified.

When a `Booking` is cancelled, the newly-freed `ShowSeat` is immediately
passed to `offerSeatToNextInLine`, which finds the oldest `waiting` entry
for that category and atomically flips it to `offered` — again via a
conditional UPDATE (`WHERE status='waiting'`), so if two seats in the same
category free at once, they can't both be offered to the same person. The
seat itself is then re-held specifically against that customer, with
`heldUntil` set to a separate, longer `WAITLIST_OFFER_TTL_MINUTES` (default
15 minutes), and an email is sent with a direct checkout link.

If the customer completes checkout in time, the booking proceeds through
the normal hold→booked path. If the offer window lapses, the same cron
sweep that expires ordinary holds also calls `expireStaleOffers()`, which
marks that waitlist entry `expired`, releases the seat, and immediately
re-invokes `offerSeatToNextInLine` for the same seat — cascading the offer
down the queue until someone claims it or the waitlist is empty, at which
point the seat simply reverts to normally `available`.

*(Word count: ~800)*
