# Employee Signup API — Spec for Backend

New endpoints needed to support self-serve employee signup with email OTP verification.
The frontend (`/signup` page) is already built and wired to call these three endpoints —
this doc describes the exact contract it expects, so the backend can be built to match
without a second round-trip.

**Base URL:** `https://divine-employee-backend.vercel.app/api/v1` (same as everything else)

**Error envelope** (same shape as every other endpoint in the guide):

```json
{ "success": false, "error": { "code": "SOME_CODE", "message": "Human-readable text" } }
```

---

## 1. `POST /auth/signup`

Starts a signup: validates the input, creates a **pending** (unverified) signup record, generates
a one-time code, and emails it to the given address. Does **not** create a login-able employee yet
— that only happens after `verify-otp` succeeds.

**Auth:** none (public endpoint).

**Request:**

```json
{
  "name": "Priya Mehta",
  "email": "priya.mehta@divinevisioninfra.com",
  "employee_id": "DVI-1042",
  "password": "at-least-8-characters"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Full name. |
| `email` | string | yes | Must be a valid email. Rejected if an employee already exists with this email. |
| `employee_id` | string | yes | The employee's official ID/code. Rejected if already registered. |
| `password` | string | yes | Minimum 8 characters. Store hashed, never plaintext. |

**Success response** — `201`:

```json
{
  "success": true,
  "data": {
    "email": "priya.mehta@divinevisioninfra.com",
    "expires_at": "2026-09-24T10:15:00+05:30"
  }
}
```

The frontend only reads `email` back to confirm and to key the next two calls. It does **not**
expect the OTP itself in this response in production (only the local mock echoes it, since it has
no real mailbox) — the code must be delivered by email only.

**Errors:**

| Status | Code | When |
|---|---|---|
| `422` | `VALIDATION_FAILED` | Missing/invalid field. Include `fields: [{ field, message }]` per the standard validation shape. |
| `409` | `EMAIL_ALREADY_REGISTERED` | An employee (verified) already uses this email. |
| `409` | `EMPLOYEE_ID_ALREADY_REGISTERED` | This employee ID is already registered to a verified employee. |

Resubmitting the form with the same email before verifying should overwrite the previous pending
signup and OTP (i.e. treat it as "start over"), not stack duplicate pending records.

**OTP rules:** 6 digits, expires in **10 minutes**.

---

## 2. `POST /auth/signup/resend-otp`

Re-sends a fresh OTP for an existing pending signup (e.g. the user didn't receive the first email,
or it expired). Used when the user taps "Resend code" on the OTP screen (frontend enforces a 30s
cooldown between taps, but the backend should also rate-limit this per email server-side).

**Auth:** none.

**Request:**

```json
{ "email": "priya.mehta@divinevisioninfra.com" }
```

**Success response** — `200`:

```json
{
  "success": true,
  "data": {
    "email": "priya.mehta@divinevisioninfra.com",
    "expires_at": "2026-09-24T10:25:00+05:30"
  }
}
```

Generates a new 6-digit code (invalidating the previous one) and re-emails it.

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | No pending signup exists for this email (never started, already verified, or expired past a grace window). Frontend shows "Start the signup form again." |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many resend attempts in a short window. |

---

## 3. `POST /auth/signup/verify-otp`

Verifies the code, promotes the pending signup into a real, active employee account, and logs them
in immediately (same tokens shape as `/auth/login`) so there's no separate "now go log in" step.

**Auth:** none.

**Request:**

```json
{ "email": "priya.mehta@divinevisioninfra.com", "otp": "482913" }
```

**Success response** — `200`, same token envelope as login:

```json
{
  "success": true,
  "data": {
    "access_token": "…",
    "refresh_token": "…"
  }
}
```

The frontend then calls `GET /auth/me` with the new access token to fetch the created employee
profile — no need to embed the employee object in this response, just the tokens.

On success the backend should:
- Create the employee record (`status: ACTIVE`) with the pending signup's name, email, employee ID
  and hashed password.
- Delete/invalidate the pending signup record and its OTP.
- Issue an access + refresh token pair exactly as `/auth/login` does.

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | No pending signup for this email. |
| `410` | `OTP_EXPIRED` | The code's 10-minute window has passed. Frontend tells the user to request a new one. |
| `422` | `INVALID_OTP` | Code doesn't match. |

Do **not** delete the pending signup on a wrong-code attempt — only on expiry or success — so the
user can retry without restarting the whole form.

---

## Error codes summary

| Code | Status | Meaning |
|---|---|---|
| `EMAIL_ALREADY_REGISTERED` | 409 | Signup email belongs to an existing employee. |
| `EMPLOYEE_ID_ALREADY_REGISTERED` | 409 | Signup employee ID belongs to an existing employee. |
| `INVALID_OTP` | 422 | Submitted code doesn't match the one on file. |
| `OTP_EXPIRED` | 410 | Code's 10-minute window passed. |
| `NOT_FOUND` | 404 | No pending signup exists for the given email (signup/verify/resend). |
| `VALIDATION_FAILED` | 422 | Standard field-validation shape, same as elsewhere in the guide. |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many resend attempts. |

---

## Open questions for the backend team

- [ ] Confirm the exact routes above (`/auth/signup`, `/auth/signup/resend-otp`,
      `/auth/signup/verify-otp`) and field names — the frontend currently assumes them but nothing
      here is live yet, so this is a proposal, not a confirmed contract.
- [ ] Confirm email delivery provider/template — the frontend has no visibility into this, it only
      expects the OTP to arrive in the user's inbox.
- [ ] Confirm whether a manager-approval step is needed before an account is usable, or whether
      OTP verification alone is sufficient to activate the account (current assumption: OTP alone
      is sufficient — `verify-otp` immediately returns usable login tokens).
- [ ] Confirm password hashing/storage approach (e.g. bcrypt) — not something the frontend can
      dictate, just flagging it must never be stored in plaintext.
- [ ] CORS: these three endpoints need to be reachable from the same allowed origins as the rest
      of the API (`employee.divinevisioninfra.com` etc.), and they're unauthenticated, so no
      bearer token will be attached.

## Checklist

- [ ] `POST /auth/signup` implemented per §1
- [ ] `POST /auth/signup/resend-otp` implemented per §2
- [ ] `POST /auth/signup/verify-otp` implemented per §3
- [ ] OTP delivered by real email (not returned in the API response)
- [ ] Passwords hashed at rest
- [ ] New employee created only after OTP verification, never before
- [ ] Duplicate email / employee ID rejected at signup time
