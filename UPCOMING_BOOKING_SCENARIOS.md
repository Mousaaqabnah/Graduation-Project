# Upcoming Booking Scenarios - Player Bookings Page

This document outlines all possible scenarios for upcoming bookings on the player bookings page.

---

## Overview

**Upcoming bookings** are bookings with status:
- `pending` - Booking created but not yet confirmed
- `upcoming` - Legacy status (treated similar to pending)
- `confirmed` - Booking is confirmed and ready

---

## Scenario Matrix

### Role-Based Scenarios

| User Role | Booking Status | Payment Method | Payment Status | Available Actions |
|-----------|---------------|----------------|----------------|-------------------|
| **Organizer** | `pending` | `organizer` | `pending` | Pay Now, Cancel, Reschedule, Payment Info |
| **Organizer** | `pending` | `organizer` | `paid` | Cancel, Reschedule, Payment Info |
| **Organizer** | `pending` | `split` | `pending` | Pay Now (share), Cancel, Reschedule, Payment Info |
| **Organizer** | `pending` | `split` | `paid` | Cancel, Reschedule, Payment Info |
| **Organizer** | `pending` | `mixed` | `pending` | Pay Now (assigned), Cancel, Reschedule, Payment Info |
| **Organizer** | `pending` | `mixed` | `paid` | Cancel, Reschedule, Payment Info |
| **Organizer** | `confirmed` | Any | `paid` | None (Confirmed status only) |
| **Participant** | `pending` | `split` | `pending` | Pay Your Share, Cancel, Reschedule, Payment Info |
| **Participant** | `pending` | `split` | `paid` | Cancel, Reschedule, Payment Info |
| **Participant** | `pending` | `mixed` | `pending` | Pay Your Share, Cancel, Reschedule, Payment Info |
| **Participant** | `pending` | `mixed` | `paid` | Cancel, Reschedule, Payment Info |
| **Participant** | `pending` | `organizer` | N/A | Cancel, Reschedule, Payment Info |
| **Participant** | `confirmed` | Any | `paid` | None (Confirmed status only) |

---

## Detailed Scenarios

### SCENARIO GROUP A: Organizer Scenarios

#### A1: Organizer - Pending Payment (Organizer Payment Method)
**Conditions:**
- Role: Organizer (you created the booking)
- Booking Status: `pending`
- Payment Method: `organizer`
- Organizer Payment Status: `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: "Pay Now (₺[totalCost])"
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️ (shows payment status modal)

**Payment Amount:** Full booking cost (₺[totalCost])

---

#### A2: Organizer - Payment Complete (Organizer Payment Method)
**Conditions:**
- Role: Organizer
- Booking Status: `pending`
- Payment Method: `organizer`
- Organizer Payment Status: `paid`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: None
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

**Note:** Booking remains pending until owner confirms (if applicable)

---

#### A3: Organizer - Pending Payment (Split Payment Method)
**Conditions:**
- Role: Organizer
- Booking Status: `pending`
- Payment Method: `split`
- Organizer Payment Status: `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: "Pay Now (₺[costPerPlayer])" - organizer's share
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

**Payment Amount:** Cost per player = Total Cost / (Players + 1)

---

#### A4: Organizer - Paid, Waiting for Participants (Split Payment Method)
**Conditions:**
- Role: Organizer
- Booking Status: `pending`
- Payment Method: `split`
- Organizer Payment Status: `paid`
- Some/All Participants: `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: None (organizer already paid)
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️ (shows payment progress)

**Payment Status Modal Shows:**
- Total players count
- Players paid count
- Players pending count
- List of all players with their payment status

---

#### A5: Organizer - Pending Payment (Mixed Payment Method)
**Conditions:**
- Role: Organizer
- Booking Status: `pending`
- Payment Method: `mixed`
- Organizer Payment Status: `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: "Pay Now (₺[assignedAmount])" - organizer's assigned amount
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

**Payment Amount:** Custom amount assigned to organizer in mixedPaymentDistribution

---

#### A6: Organizer - Paid, Waiting for Participants (Mixed Payment Method)
**Conditions:**
- Role: Organizer
- Booking Status: `pending`
- Payment Method: `mixed`
- Organizer Payment Status: `paid`
- Some/All Participants: `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: None
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

---

#### A7: Organizer - Confirmed Booking
**Conditions:**
- Role: Organizer
- Booking Status: `confirmed`
- All Payments: `paid`

**UI Elements:**
- Status Badge: "Confirmed" (green/confirmed style)
- Payment Button: None
- Cancel Button: None (confirmed bookings cannot be cancelled)
- Reschedule Link: None
- Payment Info Button: None

**Note:** Once confirmed, no actions available - booking is locked in

---

### SCENARIO GROUP B: Participant Scenarios

#### B1: Participant - Pending Payment (Split Payment Method)
**Conditions:**
- Role: Participant (you were invited)
- Booking Status: `pending`
- Payment Method: `split`
- Your Payment Status: `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: "Pay Your Share (₺[costPerPlayer])"
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

**Payment Amount:** Cost per player = Total Cost / (Players + 1)

---

#### B2: Participant - Paid, Waiting for Others (Split Payment Method)
**Conditions:**
- Role: Participant
- Booking Status: `pending`
- Payment Method: `split`
- Your Payment Status: `paid`
- Other Payments: Some/all `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: None (you already paid)
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

---

#### B3: Participant - Pending Payment (Mixed Payment Method)
**Conditions:**
- Role: Participant
- Booking Status: `pending`
- Payment Method: `mixed`
- Your Payment Status: `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: "Pay Your Share (₺[yourAssignedAmount])"
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

**Payment Amount:** Custom amount assigned to you in mixedPaymentDistribution

---

#### B4: Participant - Paid, Waiting for Others (Mixed Payment Method)
**Conditions:**
- Role: Participant
- Booking Status: `pending`
- Payment Method: `mixed`
- Your Payment Status: `paid`
- Other Payments: Some/all `pending`

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: None
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️

---

#### B5: Participant - Organizer Payment Method (No Payment Required)
**Conditions:**
- Role: Participant
- Booking Status: `pending`
- Payment Method: `organizer`
- Your Payment Status: N/A (organizer pays all)

**UI Elements:**
- Status Badge: "Pending"
- Payment Button: None (organizer handles all payment)
- Cancel Button: "Cancel Booking"
- Reschedule Link: "Reschedule"
- Payment Info Button: ℹ️ (to view payment status)

**Note:** No payment required from participants when payment method is `organizer`

---

#### B6: Participant - Confirmed Booking
**Conditions:**
- Role: Participant
- Booking Status: `confirmed`
- All Payments: `paid`

**UI Elements:**
- Status Badge: "Confirmed" (green/confirmed style)
- Payment Button: None
- Cancel Button: None
- Reschedule Link: None
- Payment Info Button: None

---

## Payment Status Modal Scenarios

The Payment Status Modal (ℹ️ button) is available for **all pending bookings** and shows:

### Modal Content:
1. **Payment Progress Summary:**
   - Total players count
   - Players paid count (green)
   - Players pending count (orange/yellow)

2. **Players Payment List:**
   - Organizer listed first with "Organizer" badge
   - All participants listed
   - Each player shows:
     - Name (your name shows as "Name (You)")
     - Payment amount (₺[amount])
     - Payment status icon (✓ for paid, ⏰ for pending)
     - Payment status text ("Paid" or "Pending")

### Payment Methods in Modal:

**Organizer Payment Method:**
- Organizer pays full amount
- Participants show no payment amount (not required)

**Split Payment Method:**
- All players (organizer + participants) pay equal share
- Amount = Total Cost / (Players + 1)

**Mixed Payment Method:**
- Each player pays custom assigned amount
- Amounts stored in `mixedPaymentDistribution` object
- Total must equal Total Cost

---

## Action Buttons Logic

### Payment Button (`pay-now-btn`)
**Shown when:**
- User is organizer AND `organizerPaymentStatus === 'pending'`
- User is participant AND `paymentStatus === 'pending'` AND `paymentMethod === 'split'`
- User is participant AND `paymentStatus === 'pending'` AND `paymentMethod === 'mixed'`

**Hidden when:**
- User has already paid
- Payment method is `organizer` and user is participant
- Booking status is `confirmed`

---

### Cancel Booking Button (`cancel-booking-btn`)
**Shown when:**
- Booking status is NOT `confirmed`
- Booking status is NOT `completed`
- Booking status is NOT `cancelled`

**Hidden when:**
- Booking status is `confirmed`
- Booking status is `completed`
- Booking status is `cancelled`

---

### Reschedule Link (`reschedule-link`)
**Shown when:**
- Same conditions as Cancel Button
- Booking status is NOT `confirmed`
- Booking status is NOT `completed`
- Booking status is NOT `cancelled`

**Note:** Currently shows alert "Reschedule functionality will be implemented soon!"

---

### Payment Status Info Button (`info-btn`)
**Shown when:**
- Booking status is `pending`

**Hidden when:**
- Booking status is `confirmed`
- Booking status is `completed`
- Booking status is `cancelled`

---

## Status Badge Display

### Status Badge Logic:
- **Confirmed:** Shows "Confirmed" with confirmed styling (green)
- **Pending:** Shows "Pending" with pending styling
- **Upcoming:** Shows "Upcoming" with upcoming styling
- **Other statuses:** Capitalized first letter (e.g., "Pending" → "Pending")

---

## Payment Method Types

### 1. `organizer`
- **Description:** Organizer pays the full booking cost
- **Organizer Payment:** Full amount (₺[totalCost])
- **Participant Payment:** None required
- **Use Case:** Organizer covers the entire booking cost

### 2. `split`
- **Description:** Cost is divided equally among all players
- **Organizer Payment:** Cost per player = Total Cost / (Players + 1)
- **Participant Payment:** Same cost per player as organizer
- **Use Case:** Fair split among all participants

### 3. `mixed`
- **Description:** Custom payment distribution with assigned amounts
- **Organizer Payment:** Custom amount from `mixedPaymentDistribution[organizerId]`
- **Participant Payment:** Custom amount from `mixedPaymentDistribution[playerId]`
- **Use Case:** Flexible payment arrangement (e.g., organizer pays more)

---

## State Transitions

### Booking Status Flow:
```
pending → confirmed (when all payments complete)
pending → cancelled (user cancels)
confirmed → completed (after booking date/time passes)
```

### Payment Status Flow:
```
pending → paid (after payment is processed)
```

---

## Code References

**Key Functions:**
- `getPaymentButton(booking)` - Determines if payment button should be shown
- `createBookingCard(booking)` - Creates the booking card UI
- `showPaymentStatusInfo(bookingId)` - Opens payment status modal
- `cancelBooking(bookingId)` - Cancels a booking
- `payForBooking(bookingId, isOrganizer)` - Initiates payment process

**Key Files:**
- `scripts/player/bookings.js` - Main booking logic
- `pages/player/bookings.html` - Booking page UI
- `styles/player/bookings.css` - Booking page styles

---

## Summary

**Total Unique Scenarios: 13**

- **Organizer Scenarios: 7**
  - 3 payment method variations × payment states + 1 confirmed state
  
- **Participant Scenarios: 6**
  - 3 payment method variations × payment states + 1 confirmed state
  - Note: `organizer` payment method has only 1 participant scenario (no payment)

**Key Variables:**
1. User Role (Organizer vs Participant)
2. Booking Status (pending, upcoming, confirmed)
3. Payment Method (organizer, split, mixed)
4. Payment Status (pending, paid)






