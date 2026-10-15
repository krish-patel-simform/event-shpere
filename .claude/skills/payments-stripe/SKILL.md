---
name: payments-stripe
description: Free and paid ticket registration with Stripe Checkout (test mode) in EventSphere: creating a Checkout Session from the database price, payments/transactions tables, webhook signature verification and idempotent confirmation, payment confirmation page, transaction history, test cards and the Stripe CLI. Use for anything about tickets, paying, Stripe, webhooks, registration status after payment, or transaction history.
---

# Payments with Stripe Checkout

Serves: REG-2, REG-3, REG-4, REG-5, REG-6, REG-7, REG-1, NOTIF-2, BE-7.
Related: `backend-architecture` (transactions), `backend-security` (webhooks/secrets), `database-drizzle`, `api-design`, `testing` (mocking Stripe).

> Check the installed `stripe` Node SDK docs for exact method signatures and the pinned API version. Say so if unsure.

## Purpose
Take payments safely: the **server decides the price**, Stripe collects the money, and a **verified webhook** (not the browser redirect) confirms the registration, exactly once.

## Flow
1. User clicks **Register**. `POST /api/events/[eventId]/registrations`.
2. Service (transaction): seat check + unique registration (REG-1). **Free event** (`priceCents = 0`) → status `confirmed` immediately + notification (REG-4, NOTIF-2). **Paid** → status `pending_payment`, seat is held.
3. For paid: create a Stripe Checkout Session (outside the DB transaction), store a `payments` row (`stripeCheckoutSessionId`, `amountCents` from DB, `status: "pending"`), return `{ registration, checkoutUrl }`; the client redirects to `checkoutUrl`.
4. Stripe redirects the user to `success_url` (`/registrations/confirmation?session_id={CHECKOUT_SESSION_ID}`) **or** `cancel_url`.
5. Stripe sends `checkout.session.completed` to `POST /api/webhooks/stripe`. After signature verification, a transaction marks payment `succeeded`, registration `confirmed`, creates the confirmation notification. Idempotent.
6. Confirmation page (REG-6) reads the registration/payment status **from our DB** (by session id, for the signed-in owner). If the webhook has not arrived yet, show "Confirming your payment…" and poll briefly (`pollingInterval`) rather than trusting the URL.
7. Transaction history (REG-7): `GET /api/me/transactions` lists the user's payments (event, amount, date, status, receipt link if available).
8. **Registration status (REG-3)**: `GET /api/me/registrations` returns each registration with `status` (`pending_payment | confirmed | cancelled`) and, for paid events, the payment state; the event detail page and "My events" page show it (badge + next action: "Complete payment", "Cancel registration"). **Cancel (REG-2)**: `DELETE /api/me/registrations/[registrationId]` (ownership checked in the service) sets `cancelled`, frees the seat in the same transaction, and notifies the user; `pending_payment` cancels also expire the Stripe session when possible.

## MUST
- Create the session with data from the **database**: `mode: "payment"`, `line_items` from the event (`price_data` with `unit_amount: event.priceCents`, `currency`, `product_data.name`), `quantity: 1`, `client_reference_id: registration.id`, `metadata: { registrationId, userId, eventId }`, `success_url`/`cancel_url` built from `NEXT_PUBLIC_APP_URL`, `customer_email` optional, `expires_at` (e.g. 30 min) so held seats are released. Pass an **idempotency key** (`registration.id`) on create.
- **Webhook route** `app/api/webhooks/stripe/route.ts`: read the **raw body** with `await req.text()`; `stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature")!, env.STRIPE_WEBHOOK_SECRET)`; on failure `400`. Handle `checkout.session.completed` (confirm only if `payment_status === "paid"`), `checkout.session.expired` (cancel the pending registration, release the seat), and optionally `async_payment_succeeded/failed`. Return `200` quickly for unhandled types.
- **Idempotency**: insert the Stripe event id into `stripe_events` (primary key) as the first step of the transaction; a duplicate → already processed → return 200. Also guard state transitions (`pending_payment → confirmed` only).
- Payment amounts, currency and product names come from DB; verify that the session's `amount_total` equals the payment row before confirming.
- Wrap Stripe in `features/payments/server/stripe-client.ts` (one place to mock in tests); never import `stripe` in client code. Publishable key only in `NEXT_PUBLIC_*` if Stripe.js is used (Checkout redirect does not need it).
- Cancel (REG-2): cancelling a **paid** registration is a product decision: document it (this POC: cancel allowed until the event starts; refunds out of scope or via `stripe.refunds.create` in test mode: decide in the REG-2 explain step and write it down).
- Errors: show the user a clear message for failed/cancelled payments; the registration stays `pending_payment` until it expires or the user retries (retry creates/reuses a session).
- Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (prints the `whsec_...` for `.env.local`); test cards `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (insufficient funds), `4000 0025 0000 3155` (3-D Secure). Use any future expiry and any CVC.

## MUST NOT
- No trusting the `success_url` redirect or `session_id` as proof of payment; no client-provided price/amount/currency.
- No parsing JSON before signature verification; no logging the full Stripe payload or card data (we never see card data).
- No calling Stripe inside a long DB transaction while holding row locks.
- No webhook logic that is not idempotent; no secrets in the client; no live-mode keys in this project.

## Procedure
1. Payments schema (`payments`, `stripe_events`) + migration. 2. Stripe client wrapper. 3. Service: `startCheckout`, `handleWebhookEvent`. 4. Routes: registration POST returns `checkoutUrl`; webhook route. 5. Confirmation page + history page + RTK endpoints. 6. Tests: service with mocked Stripe wrapper; webhook route with a **signed test payload** (`stripe.webhooks.generateTestHeaderString`); duplicate event delivery; amount mismatch; expired session. 7. E2E (TEST-2): either drive Stripe's hosted page with the test card (slower/fragile) or create the pending registration via UI and deliver a signed webhook fixture; document the choice.

## Example: webhook handler skeleton (REG-5)
```ts
export async function POST(req: Request) {
  const body = await req.text();
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET); }
  catch { return Response.json({ error: { code: "INVALID_SIGNATURE", message: "Invalid signature" } }, { status: 400 }); }
  await paymentsService.handleWebhookEvent(event);        // transaction + stripe_events dedupe
  return Response.json({ data: { received: true } });
}
```
(Plain handler because the webhook has its own auth; still use the logger and the envelope on errors.)

## Common mistakes
- Using `req.json()` then re-stringifying for verification (signature fails).
- Confirming on `success_url` load → users who close the tab pay but stay `pending`; users who edit the URL "pay" for free.
- Forgetting to release seats of expired/abandoned checkouts (overselling/under-selling).
- Treating the webhook as exactly-once (Stripe retries; duplicates happen).
- Using `Number` money with decimals instead of integer cents.

## Final checklist
- [ ] Price from DB; session metadata links registration; idempotency key used.
- [ ] Raw-body signature verification; events deduped; transitions guarded.
- [ ] Confirmation page reads DB status; handles "still confirming".
- [ ] Transaction history scoped to the user; DTOs hide Stripe internals.
- [ ] Tests: signed webhook, duplicate delivery, amount mismatch, expiry.
