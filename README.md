# MatchField

A full-stack sports field booking platform that allows players to discover sports fields, make bookings, manage teams, split booking costs, and communicate with field owners through a centralized platform.

## Overview

MatchField was developed as a graduation project to provide a complete digital solution for sports field booking and management.

The platform supports multiple user roles, including:

- Players
- Field Owners
- Administrators

Players can discover available fields, manage bookings, invite other players, split costs, and manage their profiles.

Field owners can manage their fields, availability, bookings, and ownership information.

Administrators can manage users, fields, approvals, notifications, and support operations.

## Key Features

### Player

- Browse and search sports fields
- View field details and locations
- Select available dates and time slots
- Create and manage bookings
- Invite players to bookings
- Split booking costs
- Manage profile and preferences
- Receive notifications
- Submit reviews after completed bookings
- Arabic and English interface

### Field Owner

- Create and manage sports fields
- Manage field availability
- Manage bookings
- Submit ownership and verification documents
- Manage field information and images
- View field-related activity

### Administrator

- Manage users
- Review and manage field submissions
- Approve or reject fields
- Manage notifications
- Manage support requests
- Monitor platform operations

## Booking & Payment Workflow

The booking flow is designed around multiple payment strategies:

- **Organizer** — the booking organizer covers the full cost.
- **Split** — the booking cost is divided between participants.
- **Mixed** — supports a combination of organizer and participant payments.

The platform also handles booking state transitions, payment settlement, expiration, and concurrency controls to prevent conflicting bookings.

## Authentication & Authorization

MatchField includes a role-based authentication system with:

- JWT-based authentication
- Role-based access control (RBAC)
- Google OAuth 2.0
- Secure OAuth state handling
- PKCE
- Session invalidation for suspended users
- Protected API routes
- Server-side authorization checks

Google OAuth is implemented with security controls including nonce validation, state protection, and ID token verification.

## Technology Stack

### Backend

- Node.js
- Express.js
- REST APIs
- Prisma ORM

### Frontend

- HTML
- CSS
- JavaScript
- Responsive UI
- Arabic / English localization
- RTL support

### Database & Storage

- PostgreSQL
- Supabase
- Supabase Storage

### Authentication & Security

- JWT
- Google OAuth 2.0
- Role-Based Access Control
- Input validation
- Rate limiting
- Secure file validation
- Centralized error handling
- Protected private document access

### Development

- Git
- GitHub
- Automated regression testing

## Storage Architecture

MatchField uses Supabase Storage for application file management.

Two storage areas are used:

- Public storage for avatars and field gallery images
- Private storage for ownership and verification documents

Private documents are protected through authenticated server-side access and authorization checks.

File uploads are validated using:

- File size limits
- MIME type validation
- File signature / magic-byte validation
- Protected storage paths
- Restrictions on unsafe file types

## Localization

The application supports:

- English
- Arabic

The Arabic interface includes RTL layout support and localized formatting for dates, currencies, and common platform messages.

The application is configured with Palestine-oriented defaults including:

- ILS currency
- Asia/Jerusalem timezone
- Palestine-oriented location defaults

## Security

Security was treated as a core part of the project rather than an afterthought.

The application includes protections for areas such as:

- Authentication endpoints
- Authorization and role checks
- Booking concurrency
- Payment settlement consistency
- File uploads
- Private documents
- User sessions
- Input validation
- Rate limiting
- CORS / allowed-origin policies
- Safe error responses
- Stored XSS prevention

## Testing

The project includes automated regression and security test suites covering critical application workflows.

The latest internal regression testing covered:

- OAuth authentication
- Security controls
- Critical booking/payment flows
- High-priority production fixes
- User preferences
- Supabase Storage
- Removal of the previous internal user-to-user chat system

## Project Structure

```text
MatchField/
├── assets/
├── components/
├── lib/
├── middleware/
├── pages/
├── prisma/
├── routes/
├── scripts/
├── server/
├── styles/
├── .env.example
├── .gitignore
└── PROJECT_STRUCTURE.md
```

## Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/Mousaaqabnah/Graduation-Project.git
cd Graduation-Project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file based on `.env.example`.

Configure the required database, authentication, OAuth, and Supabase variables.

**Do not commit `.env` or any production credentials to the repository.**

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Apply database migrations

```bash
npx prisma migrate deploy
```

### 6. Start the application

```bash
npm start
```

Refer to the project's environment configuration and scripts for additional development and testing commands.

## Project Status

MatchField is a completed graduation project that has undergone multiple rounds of security hardening, regression testing, database migration, storage migration, localization, and authentication improvements.

The repository is maintained as a portfolio project demonstrating full-stack web development, backend API development, database design, authentication, security, and production-oriented engineering practices.

## Author

**Mousa Aqabnah**

Software Engineer | Full-Stack Developer

- LinkedIn: [Mousa Aqabnah](https://www.linkedin.com/in/mousa-aqabnah-9aa298419/)
- GitHub: [Mousaaqabnah](https://github.com/Mousaaqabnah)
