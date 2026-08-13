# MatchField - Setup Instructions

Now that your database is connected, follow these steps to get everything running:

## Step 1: Install Backend Dependencies

Run this command to install all required packages:

```bash
npm install
```

This will install:
- Express.js (web server)
- Prisma Client (database ORM)
- JWT (authentication)
- bcryptjs (password hashing)
- CORS (cross-origin requests)
- Other dependencies

## Step 2: Set Up Environment Variables

1. Create a `.env` file in the project root (if it doesn't exist)
2. Add the following variables:

```env
# Database
DATABASE_URL="your-mongodb-connection-string-here"

# JWT Secret (change this to a random string)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Server
PORT=3000
NODE_ENV=development

# API Base URL
API_BASE_URL="http://localhost:3000/api"
```

**Important:** 
- Replace `your-mongodb-connection-string-here` with your actual MongoDB connection string
- Change `JWT_SECRET` to a random secure string (you can generate one online)

## Step 3: Generate Prisma Client

Make sure Prisma Client is generated:

```bash
npm run db:generate
```

## Step 4: Start the Server

Start the backend server:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Step 5: Test the API

1. Open your browser and go to: `http://localhost:3000/health`
   - You should see: `{"status":"ok","message":"MatchField API is running"}`

2. Test the API endpoints:
   - Health check: `GET http://localhost:3000/health`
   - Register: `POST http://localhost:3000/api/auth/register`
   - Login: `POST http://localhost:3000/api/auth/login`

## Step 6: Access Your Application

1. **Frontend Pages:**
   - Login: `http://localhost:3000/pages/auth/login.html`
   - Signup: `http://localhost:3000/pages/auth/signup.html`
   - Admin Dashboard: `http://localhost:3000/pages/admin/dashboard.html`
   - Player Home: `http://localhost:3000/pages/player/home.html`
   - Owner Dashboard: `http://localhost:3000/pages/owner/dashboard.html`

2. **API Endpoints:**
   - All API routes are under: `http://localhost:3000/api/`
   - Authentication: `/api/auth/*`
   - Users: `/api/users/*`
   - Fields: `/api/fields/*`
   - Bookings: `/api/bookings/*`
   - Reviews: `/api/reviews/*`
   - Favorites: `/api/favorites/*`
   - Notifications: `/api/notifications/*`
   - Support / Contact Us: `/api/support/*`
   - Admin: `/api/admin/*`

## Available API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)
- `PUT /api/auth/password` - Update password (requires auth)

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile
- `GET /api/users/search/users?q=query` - Search users

### Fields
- `GET /api/fields` - Get all fields
- `GET /api/fields/:id` - Get field by ID
- `POST /api/fields` - Create field (Owner/Admin)
- `PUT /api/fields/:id` - Update field
- `DELETE /api/fields/:id` - Delete field
- `GET /api/fields/owner/:ownerId` - Get fields by owner

### Bookings
- `GET /api/bookings` - Get bookings (filtered by user role)
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id/status` - Update booking status
- `POST /api/bookings/:id/participants` - Add participant

### Reviews
- `GET /api/reviews/field/:fieldId` - Get reviews for a field
- `POST /api/reviews` - Create/update review
- `DELETE /api/reviews/:id` - Delete review

### Favorites
- `GET /api/favorites` - Get user's favorites
- `POST /api/favorites` - Add to favorites
- `DELETE /api/favorites/:fieldId` - Remove from favorites
- `GET /api/favorites/check/:fieldId` - Check if favorited

### Notifications
- `GET /api/notifications/me` - Current user's notifications

### Support / Contact Us
- `POST /api/support/contact` - Submit a contact / support request
- Admin support inbox: `/api/admin/support/*`

### Admin
- `GET /api/admin/stats` - Get dashboard stats
- `GET /api/admin/verifications` - Get pending verifications
- `PUT /api/admin/verify-owner/:userId` - Verify owner

## Frontend Integration

The frontend is already set up to use the API. The `scripts/utils/api.js` file provides helper functions:

```javascript
// Example usage in your frontend scripts:
await API.auth.login(email, password);
await API.fields.getAll();
await API.bookings.create(bookingData);
```

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Verify your `.env` file exists and has correct values
- Make sure MongoDB connection string is correct

### Database connection errors
- Verify your `DATABASE_URL` in `.env` is correct
- Check if MongoDB is running (if local) or accessible (if Atlas)
- Run `npm run db:push` to sync schema

### Authentication errors
- Make sure `JWT_SECRET` is set in `.env`
- Check that tokens are being sent in request headers: `Authorization: Bearer <token>`

### CORS errors
- The server is configured to allow CORS from all origins in development
- In production, update CORS settings in `server.js`

## Next Steps

1. **Create your first admin user:**
   - You can manually create an admin user in the database or use Prisma Studio:
   ```bash
   npm run db:studio
   ```

2. **Test the registration flow:**
   - Go to signup page and create a player account
   - Try logging in with the new account

3. **Test owner registration:**
   - Sign up as an owner
   - Submit verification documents (if implemented)
   - Admin can approve via `/pages/admin/verification.html`

4. **Add more features:**
   - Update other frontend scripts to use the API
   - Add file upload for field images and owner verification
   - (Internal user chat / WebSocket messaging was removed from the product)

## Development Tips

- Use `npm run dev` for development (auto-reloads on changes)
- Use `npm run db:studio` to view/edit database in browser
- Check server logs in terminal for debugging
- Use browser DevTools Network tab to inspect API calls

## Production Deployment

Before deploying to production:

1. Change `JWT_SECRET` to a strong random string
2. Set `NODE_ENV=production`
3. Update CORS settings to allow only your frontend domain
4. Use environment variables for all sensitive data
5. Set up proper error logging
6. Configure HTTPS
7. Set up database backups

## File storage (local vs Supabase)

MatchField stores files through `lib/storage` — routes never call Supabase directly.

| Provider | When | Behavior |
|----------|------|----------|
| `local` | Default in development | Writes under `storage/private/` and `uploads/public/` |
| `supabase` | Default in production | Uploads to `matchfield-public` / `matchfield-private` |

Production does **not** silently fall back to disk if Supabase is misconfigured. The process exits.

Required for `STORAGE_PROVIDER=supabase` (backend `.env` only — never frontend):

```
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PUBLIC_BUCKET=matchfield-public
SUPABASE_PRIVATE_BUCKET=matchfield-private
```

Create two buckets in the Supabase dashboard:

1. `matchfield-public` — public read (gallery + avatars)
2. `matchfield-private` — **not** publicly readable (KYC, ownership, licenses)

Private documents are still downloaded only via authenticated API routes (`GET /api/fields/:id/documents/:docType`). Object keys are stored in Postgres (`storage_path`), never signed URLs.

Migrate existing local files (dry-run first):

```bash
npm run migrate:storage
# after review:
node scripts/migrate-storage-to-supabase.js --apply
```

`--apply` uploads and updates DB refs. It does **not** delete local source files.

---

**You're all set!** Start the server and begin testing your application. 🚀

