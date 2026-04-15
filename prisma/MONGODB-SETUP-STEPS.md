# Steps to Add the Database to MongoDB

Follow these steps to connect MatchField to MongoDB and create your collections.

---

## Option A: MongoDB Atlas (Cloud – recommended)

### 1. Create a MongoDB Atlas account
- Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Sign up or log in
- Create a **free** M0 cluster (no credit card required)

### 2. Create a database user
- In Atlas: **Database Access** → **Add New Database User**
- Choose **Password** authentication
- Set a username and password (save them somewhere safe)
- Role: **Atlas Admin** or **Read and write to any database**
- Click **Add User**

### 3. Allow network access
- In Atlas: **Network Access** → **Add IP Address**
- Either:
  - **Add Current IP Address** (for your current machine), or
  - **Allow Access from Anywhere** (`0.0.0.0/0`) for development only
- Confirm

### 4. Get your connection string
- In Atlas: **Database** → **Connect** on your cluster
- Choose **Connect your application**
- Copy the connection string. It looks like:
  ```text
  mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
  ```
- Replace `<username>` and `<password>` with your database user (from step 2)
- Add the database name before `?` if you want a specific DB, e.g.:
  ```text
  mongodb+srv://myuser:mypass@cluster0.xxxxx.mongodb.net/matchfield?retryWrites=true&w=majority
  ```

### 5. Put the URL in your project
- In your project root, copy the example env file:
  ```bash
  copy .env.example .env
  ```
  (On macOS/Linux: `cp .env.example .env`)
- Open `.env` and set:
  ```env
  DATABASE_URL="mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/matchfield?retryWrites=true&w=majority"
  ```
  Use your real username, password, and cluster host. If the password has special characters, URL-encode them (e.g. `@` → `%40`).

### 6. Push the schema and generate the client
- In the project folder, run:
  ```bash
  npm run db:push
  npm run db:generate
  ```
- `db:push` creates/updates the collections in MongoDB
- `db:generate` ensures the Prisma Client is up to date

### 7. Check that it worked
- Run:
  ```bash
  npm run db:studio
  ```
- Prisma Studio opens in the browser; you should see your database and collections (users, fields, bookings, etc.)

---

## Option B: Local MongoDB

### 1. Install MongoDB
- **Windows:** [MongoDB Community Server](https://www.mongodb.com/try/download/community) – run the installer
- **macOS:** `brew install mongodb-community` then `brew services start mongodb-community`
- **Linux:** follow [Install MongoDB Community](https://www.mongodb.com/docs/manual/administration/install-on-linux/) for your distro

Make sure the MongoDB service is running (e.g. Windows: MongoDB Compass or Services; Mac: `brew services list`).

### 2. Create the `.env` file
- In project root:
  ```bash
  copy .env.example .env
  ```
- Edit `.env`:
  ```env
  DATABASE_URL="mongodb://localhost:27017/matchfield"
  ```
  `matchfield` is the database name; you can change it.

### 3. Push the schema and generate the client
- In the project folder:
  ```bash
  npm run db:push
  npm run db:generate
  ```

### 4. Verify
- Run:
  ```bash
  npm run db:studio
  ```
- You should see the `matchfield` database and its collections.

---

## Quick reference

| Step | Command / Action |
|------|-------------------|
| 1 | Create Atlas cluster **or** install local MongoDB |
| 2 | Create DB user (Atlas) or leave default (local) |
| 3 | Copy `.env.example` to `.env` |
| 4 | Set `DATABASE_URL` in `.env` (Atlas or `mongodb://localhost:27017/matchfield`) |
| 5 | Run `npm run db:push` |
| 6 | Run `npm run db:generate` |
| 7 | Run `npm run db:studio` to open the database in the browser |

---

## Troubleshooting

- **Connection refused:** MongoDB is not running (local) or IP not allowed / wrong URL (Atlas).
- **Authentication failed:** Wrong username/password in `DATABASE_URL`, or special characters in password not URL-encoded.
- **`db:push` fails:** Check that `DATABASE_URL` in `.env` has no extra spaces or quotes inside the URL.
