# MatchField Database (Prisma + MongoDB)

This folder contains the Prisma schema for the MatchField sports venue booking platform using **MongoDB**.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure database**
   - Copy `.env.example` to `.env`
   - Set `DATABASE_URL` to your MongoDB connection string, e.g.:
     - **MongoDB Atlas:** `mongodb+srv://USER:PASSWORD@cluster.mongodb.net/matchfield?retryWrites=true&w=majority`
     - **Local MongoDB:** `mongodb://localhost:27017/matchfield`

3. **Push schema to MongoDB** (MongoDB does not use Prisma Migrate)
   ```bash
   npm run db:push
   ```

4. **Generate Prisma Client**
   ```bash
   npm run db:generate
   ```

**Note:** With MongoDB, use only `db:push` to sync your schema. Do not use `db:migrate` (migrations are not supported for MongoDB).

## Schema Overview

| Model | Description |
|-------|-------------|
| **User** | Players, field owners, and admins. Includes verification fields for owners. |
| **Field** | Sports venues (name, sport, type, price, location, features, images). |
| **FieldUnavailableDate** | Dates when a field is not available for booking. |
| **Review** | User reviews for fields (rating, text, context). |
| **Booking** | A booking slot (field, date, time, organizer, payment method, status). |
| **BookingParticipant** | Participants in a booking with per-user payment status. |
| **Favorite** | User's favorite fields. |
| **Notification** | In-app notifications (booking, payment, support, system). |
| **UserNotification** | Per-user notification delivery / read state. |
| **SupportTicket** | Contact Us / admin support inbox tickets. |
| **SupportMessage** | Messages on a support ticket (not user↔user chat). |

> Internal user↔user Chat (`Conversation` / `Message`) was removed in product Phase 3.

## Scripts

- `npm run db:generate` – Generate Prisma Client
- `npm run db:push` – Push schema to MongoDB (use this to create/update collections)
- `npm run db:studio` – Open Prisma Studio to browse data
- `npm run db:seed` – Run seed script (if added)

*(MongoDB does not support `db:migrate`; use `db:push` only.)*

## Using Prisma in your app

After `npm run db:generate`, you can use the client in Node:

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Example: find all fields
const fields = await prisma.field.findMany({ include: { owner: true } });
```
