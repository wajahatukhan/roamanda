# 7. Event-driven architecture

**Status:** proposed. Async processing must **never compromise booking or
payment integrity** (brief §9). The design therefore centers on the
**transactional outbox**, not fire-and-forget.

---

## 7.1 Where async belongs [Proposed]

Synchronous (request path, must be fast and fail-soft): search, hotel content,
pricing, availability, prebook, the booking *finish* call itself.

Asynchronous (off the request path): everything that can happen slightly later
without the user waiting, and everything that must happen **reliably even if a
consumer is down**:

- Booking **confirmation** side-effects (voucher, email, analytics).
- **Email/SMS notifications** (confirmation, failure+refund, cancellation).
- **Cancellation processing** follow-through (refund, supplier cancel, notify).
- **Payment events** (captured, failed, refunded) → booking state + notify.
- **Supplier synchronization** (content dumps, incremental updates).
- **Hotel content updates** and `missing_hotels` clearing once content arrives.
- **Reconciliation** of "unknown outcome" bookings (timeout on finish).
- **Analytics events** (search, offer-shown, booking funnel).

---

## 7.2 Broker choice: SQS/SNS vs RabbitMQ [Proposed]

| | AWS SNS + SQS (recommended) | RabbitMQ |
|---|---|---|
| Ops burden | fully managed, no cluster | self-managed or managed add-on |
| Fit with ECS/Fargate | native, same account/VPC | extra infra |
| DLQ, retries, FIFO | built in (FIFO + dedup for exactly-once-ish) | built in, more routing flexibility |
| Routing topology | SNS fan-out → per-service SQS | exchanges/bindings (richer) |
| Throughput | very high, elastic | high, capacity-planned |

**Recommendation:** **SNS (topics) + SQS (per-consumer queues)** given the
AWS/ECS infrastructure direction ([INFRASTRUCTURE_AND_DEVOPS.md](INFRASTRUCTURE_AND_DEVOPS.md))
— least operational overhead, native DLQs, FIFO queues with content-based
deduplication for the booking/payment paths. RabbitMQ only if complex routing
later justifies it. Keep publishers broker-agnostic behind a thin `EventBus`
interface so the broker is swappable.

---

## 7.3 Transactional outbox (the core pattern) [Proposed]

A state change and the event announcing it **must** commit together. Dual-writes
(write DB, then publish) lose events on crash. Instead:

```
Booking "finish" succeeds:
  BEGIN (booking DB, local txn)
    insert/update orders, order_items          -- the state change
    insert booking_events (outbox row, status=pending)   -- the event
  COMMIT                                        -- both or neither

  Relay (worker or CDC):
    read pending outbox rows → publish to SNS → mark published
    (at-least-once; consumers are idempotent)
```

- **Outbox tables** per writing service: `booking.booking_events`,
  `payment.payment_events`.
- **Relay** options: a polling worker (simplest, start here) or CDC
  (Debezium/logical replication) later for lower latency.
- **At-least-once + idempotent consumers** — every consumer dedupes by event id
  (Redis/DB uniqueness). Notification, analytics and reconciliation are all
  idempotent.
- **Ordering** where it matters (a single order's events) via FIFO queue with
  the order id as group key.

---

## 7.4 Representative workflows [Proposed]

### Booking confirmation
```
finish() → order COMMITTED (+ outbox: BookingConfirmed)
 → SNS BookingConfirmed → SQS: notifications (email), analytics, voucher-gen
```

### Failed booking → automatic refund (no support team — handover §10)
```
finish() returns error / status=failed
 → outbox: BookingFailed  → SQS: refund worker (Payment.refund, idempotent)
                                 → outbox: Refunded → notify traveler
```

### Unknown outcome (timeout on finish — follow-ups: retries OFF)
```
finish() times out → DO NOT retry blindly
 → order status = unknown (+ outbox: BookingOutcomeUnknown)
 → reconciliation worker polls provider getBookingStatus by partner_order_id
   until ok | failed → resolve (confirm or refund+notify)
```

### Payment webhook (ETG supplier webhook, or PSP)
```
webhook received → verify signature (HMAC-SHA256 of timestamp+token,
  per etg-api-notes) → idempotent handler → outbox: PaymentSettled/Failed
```

### Content sync
```
scheduled → sync worker pulls dump/content → upsert (Content) → outbox:
  HotelContentUpdated → clear missing_hotels, warm caches, analytics
```

---

## 7.5 Integrity guarantees [Proposed]

1. **No event without its state change** (outbox, single local txn).
2. **No state change lost to a down consumer** (durable queue, DLQ, retries).
3. **No double side-effect** (idempotent consumers, keyed by event id).
4. **No double booking/charge** (retries off on finish/capture; new
   `partner_order_id` per booking attempt; reconciliation resolves unknowns).
5. **Money never on a lossy path** — refunds are driven by committed events, not
   best-effort calls; a refund that fails stays queued (DLQ) and alerts, never
   silently dropped.
