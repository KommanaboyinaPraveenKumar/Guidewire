# Claim-Secure

Claim-Secure is an AI-powered weekly income protection platform for India's gig economy. The current app experience is branded as `SentinelAI` and is built for delivery workers whose earnings are disrupted by external events such as heavy rain, flooding, pollution, extreme heat, and sudden zone closures.

This repo now demonstrates a parametric insurance MVP with weekly pricing, automated disruption monitoring, zero-touch income-loss claims, payout simulation, and admin operations tooling.

## Overview

Gig workers often lose 20-30% of their monthly income when outdoor work is interrupted by weather or social disruptions. Claim-Secure protects income, not health, life, accident, or vehicle repair costs.

The product flow is:

1. Worker completes onboarding with city, operating zone, platform, vehicle type, weekly income, work hours, and UPI ID.
2. The platform calculates a weekly premium and activates a policy automatically.
3. Mock disruption feeds monitor the worker's zone for external trigger events.
4. When a matching trigger is detected, the system creates an income-loss claim automatically.
5. Fraud and anomaly checks decide whether the claim is auto-paid or routed to admin review.

## What The App Demonstrates

- Optimized worker onboarding for delivery personas
- Weekly policy creation and management
- Dynamic premium calculation using hyper-local and worker-specific risk signals
- Predictive-style risk scoring for weekly pricing
- 5 automated disruption triggers using mock feeds
- Zero-touch claim initiation for income loss
- Fraud-aware validation with duplicate prevention and zone matching
- Mock payout processing via UPI-style payout references
- Analytics dashboard for policies, claims, triggers, and payouts
- Admin operations console for triggers, policies, and flagged claims

## Feature Mapping To The Brief

### Registration Process

Worker onboarding captures:

- name
- phone
- email
- platform
- vehicle type
- city
- operating zone
- weekly income
- average hours per day
- work days per week
- UPI ID

On successful registration, the app creates:

- a `User`
- a `WorkerProfile`
- an active weekly `Policy`

### Insurance Policy Management

Each worker can view:

- policy number
- weekly premium
- weekly coverage
- coverage hours
- risk score
- pricing breakdown
- payout channel

Admin can:

- pause or resume policies
- review policy exposure across workers

### Dynamic Weekly Premium Calculation

The premium engine uses worker and zone-level signals such as:

- city and zone risk
- platform intensity
- vehicle type
- weekly income
- average work hours
- work days per week
- trust score

The current MVP uses an explainable risk engine and pricing rules that mimic predictive AI behavior for demo scope. It is designed so a real trained model can later replace or augment the rule engine.

### Automated Triggers

The seeded mock trigger catalog includes 5 disruption types:

- heavy rain
- flooding / waterlogging
- severe pollution
- extreme heat
- zone closure

These triggers are matched against the worker's registered city and operating zone.

### Zero-Touch Claims

Zero-touch means the worker does not fill a claim form when a disruption happens.

Instead, the system:

1. detects an active disruption trigger
2. matches insured workers in the affected zone
3. estimates lost income
4. creates the claim automatically
5. runs anomaly and fraud checks
6. auto-pays low-risk claims or sends flagged claims to admin review

### Intelligent Fraud Detection

The current app includes:

- zone-level location validation
- duplicate claim prevention
- payout anomaly scoring
- trust-score-aware review routing

Important: this MVP validates workers at the operating-zone level, not through exact live device GPS. That keeps the demo honest while still showing location-aware fraud controls.

## Demo Accounts

After seeding the database, the following accounts are available:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sentinel.ai` | `admin123` |
| Worker | `user@sentinel.ai` | `user123` |
| Worker | `ops.worker@sentinel.ai` | `ops12345` |

Behavior:

- `admin@sentinel.ai` is redirected to `/admin`
- worker accounts see the policy workspace on `/`

## Demo Flow

Recommended recording flow:

1. Open `/register` and show worker onboarding fields.
2. Sign in as `user@sentinel.ai`.
3. Show weekly premium, coverage, and pricing breakdown on `/`.
4. Show active triggers.
5. Click `Simulate demo disruption` to create a fresh zero-touch claim.
6. Open `/cases` to show the auto-created claim and payout state.
7. Open `/dashboard` to show analytics.
8. Sign in as `admin@sentinel.ai` and open `/admin`.
9. Show trigger toggles, policy pause/resume, and claim approve/block/reopen controls.

## Tech Stack

### Frontend

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Recharts
- NextAuth
- Lucide React

### Backend

- Next.js App Router API routes
- Prisma ORM
- SQLite with libsql adapter

### Legacy / Optional

- `ml_service/` remains in the repo from the earlier fraud-detection implementation
- it is not required to run the current worker-protection flow

## Project Structure

```text
Guidewire/
├── app/
│   ├── admin/                    # Admin operations console
│   ├── api/
│   │   ├── admin/operations/     # Admin actions and payloads
│   │   ├── auth/                 # NextAuth routes
│   │   ├── claims/               # Zero-touch claim automation and simulation
│   │   ├── dashboard/            # Worker analytics data
│   │   ├── policy/               # Worker policy context and sync
│   │   └── register/             # Worker onboarding API
│   ├── cases/                    # Worker claims page
│   ├── dashboard/                # Worker analytics dashboard
│   ├── login/                    # Sign-in page
│   ├── register/                 # Worker onboarding page
│   └── page.tsx                  # Landing page / worker workspace
├── components/
│   ├── ClaimsBoard.tsx           # Claims list and automation UI
│   ├── DashboardCharts.tsx       # Analytics visualizations
│   ├── Navbar.tsx                # Role-aware navigation
│   ├── PolicyWorkspace.tsx       # Worker policy workspace
│   └── SessionWrapper.tsx        # Auth provider
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   ├── platformCatalog.ts        # Supported cities, zones, platforms, vehicles
│   ├── platformService.ts        # Policy, claim, trigger, and admin services
│   ├── prisma.ts                 # Prisma client
│   └── protectionEngine.ts       # Pricing, payout, and fraud scoring logic
├── prisma/
│   ├── schema.prisma             # User, worker, policy, trigger, claim models
│   └── seed.ts                   # Demo users, triggers, policies, and claims
├── types/
│   ├── next-auth.d.ts
│   └── platform.ts
├── ml_service/                   # Legacy optional service from earlier version
└── README.md
```

## Database Models

The current application flow is driven by:

- `User`
- `WorkerProfile`
- `Policy`
- `TriggerEvent`
- `IncomeClaim`

The schema still contains legacy `Claim` and `ModelWeights` models from the earlier fraud-detection build, but the active app flow now uses the worker-protection models above.

## API Summary

### `GET /api/policy`

Returns the current worker's profile, policy, active triggers, and recent claims summary.

### `POST /api/policy`

Re-syncs the current worker's weekly quote and policy context.

### `GET /api/claims`

Returns the current worker's income-loss claims.

### `POST /api/claims`

Runs zero-touch protection automation for the current worker.

### `POST /api/claims` with `{ "mode": "simulate" }`

Creates a fresh mock disruption for the current worker's zone and immediately runs automation. This is the easiest path for a reliable demo.

### `GET /api/dashboard`

Returns the worker analytics payload for charts and KPIs.

### `GET /api/admin/operations`

Returns the admin dashboard payload with triggers, policies, claims, payouts, and system metrics.

### `PATCH /api/admin/operations`

Supports admin actions for:

- trigger activation / deactivation
- policy pause / resume
- claim approve / block / reopen

## Local Setup

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
npx prisma generate
npx prisma db push
npm run seed
```

### Run In Development

```bash
npm run dev
```

Open `http://localhost:3000`.

### Run In Production Mode

```bash
npm run build
npm run start
```

Production mode is the most stable way to record the demo video.

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

## Constraints And Product Scope

- Coverage is for income loss only
- No health, life, accident, or vehicle repair coverage
- Weekly pricing model only
- Trigger monitoring is currently mock-driven
- Payout references are mock UPI-style values
- Location validation is zone-based, not exact real-time GPS

## Troubleshooting

### Prisma client module error

```bash
npx prisma generate
```

### Database out of sync

```bash
npx prisma db push
npm run seed
```

### UI loads without styles or scripts

If you see 404 errors for `main-app.js`, `layout.css`, or similar chunk files:

```bash
rm -rf .next
npm run dev
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

### Want a reliable zero-touch demo moment

Sign in as `user@sentinel.ai` and click `Simulate demo disruption` from the worker workspace.

## License

This project is provided as-is for educational and hackathon use.
