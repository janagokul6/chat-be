# Chat Backend

A simple chat backend using PostgreSQL (Prisma) for users and Cloud Firestore for messages.

## Setup

1. Configure your `.env`:

```bash
cp .env.example .env
```

Make sure your `DATABASE_URL`, `FIREBASE_PROJECT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS` path are set.

2. Install packages:

```bash
pnpm install
```

3. Sync database tables and seed users:

```bash
pnpm setup
```

4. Run the app:

```bash
pnpm dev
```

Open http://127.0.0.1:3000 in your browser.

## Where to get credentials

### Neon Postgres (`DATABASE_URL`)
1. Go to [neon.tech](https://neon.tech), create a free account, and create a project.
2. On your dashboard, copy the **Connection string** (e.g. `postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require`).
3. Paste it into `.env` as `DATABASE_URL`.

### Firebase Service Account (`FIREBASE_PROJECT_ID` & `service-account.json`)
1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. In the left menu, open **Build > Firestore Database** and click **Create database** (choose Test mode).
3. Click the **Settings gear (⚙️) > Project settings** at top left.
4. Copy your **Project ID** from the *General* tab for `FIREBASE_PROJECT_ID`.
5. Head to the **Service accounts** tab, select **Node.js**, and click **Generate new private key**.
6. Save the downloaded file as `service-account.json` in this project folder and set its path in `GOOGLE_APPLICATION_CREDENTIALS`.
