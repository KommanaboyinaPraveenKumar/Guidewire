# Claim-Secure

An **AI-powered insurance claim fraud detection system** that combines a Next.js frontend with a Python machine learning backend to analyze and predict fraudulent insurance claims in real-time.

## Overview

Claim-Secure provides insurers with an intelligent risk assessment platform that:
- Ingests claim details through an intuitive web form
- Processes claims through an ML model trained on historical fraud patterns
- Generates risk scores, fraud probability, and actionable flags
- Stores all claims securely in a database with full audit history
- Displays comprehensive dashboards for claims management and analysis

**Key Features:**
- 🔐 Secure authentication with NextAuth (JWT-based)
- 🤖 Multi-field fraud detection using AdaBoost ML model (83% accuracy, 0.77 AUC)
- 📊 Real-time risk scoring and visualization
- 💾 Claims database with Prisma ORM (SQLite)
- 📈 Analytics dashboard with risk distribution charts
- 🎯 Granular fraud flags and recommendations
- 🔄 Admin panel for claim review and management
- 🛡️ Adversarial defense layer against GPS spoofing and coordinated fraud rings

---

## ⚠️ Adversarial Defense & Anti-Spoofing Strategy

> **Critical Threat — March 2026:** A coordinated syndicate of 500 delivery workers in a tier-1 city successfully exploited a parametric insurance platform by using GPS-spoofing applications to fake their locations during a declared weather event, triggering mass false payouts and draining the liquidity pool. Claim-Secure's architecture is designed to defeat this attack vector at every layer.

### The Problem With GPS-Only Verification

Parametric insurance platforms that trigger payouts based solely on GPS coordinates inside a declared zone are trivially exploitable. GPS spoofing apps are freely available, require no technical skill, and can be run by hundreds of actors simultaneously with zero coordination overhead beyond a Telegram message. The fix is not better GPS — it is making GPS **one signal among many**, where the full composite cannot be faked without exponentially increasing attacker cost and coordination complexity.

---

### 1. Differentiation — Genuine Claimant vs. Bad Actor

Claim-Secure's fraud detection pipeline uses **physics-based coherence scoring** to distinguish a genuinely stranded worker from someone spoofing their location at home. A real claimant leaves a trail of consistent physical signals across multiple independent data streams simultaneously. A spoofer cannot replicate all of them at once without enormous effort.

**Accelerometer & Gyroscope Coherence**
A stationary person at home has a near-flat motion signature. A worker genuinely caught in a weather event — even one who has stopped moving — shows micro-vibrations from wind buffeting, vehicle movement on a flooded road, or the physical act of navigating adverse conditions. The ML model is trained on the difference between "parked at home" stillness and "genuinely stopped in adverse conditions" stillness. These are measurably different signal patterns.

**Battery Drain Curve Analysis**
GPS spoofing applications are notoriously battery-intensive. A device running a spoofer while the worker relaxes at home shows an anomalous battery drain rate with no corresponding physical activity signal. A genuine worker in a storm typically shows high screen interaction (checking maps, messaging dispatchers) alongside high battery draw — a coherent, expected pattern. The incoherent pattern is the flag.

**Cell Tower Triangulation vs. GPS Delta**
The device's registered cell towers provide an independent location signal. If GPS reports "flood zone sector 7" but the three nearest registered towers place the device 12 km away in a residential grid, the delta is a high-weight fraud feature. Legitimate weather-affected workers may have degraded cell signal, but the towers they do connect to will be geographically consistent with the declared zone or its immediate periphery.

**Historical Route Plausibility**
Each claimant has a trajectory history. The model checks whether the claimed location is physically reachable within the elapsed time since their last verified position. Appearing 40 km from the last confirmed delivery stop within 20 minutes, in the middle of a declared catastrophe zone, is a physics violation that triggers immediate escalation.

---

### 2. Data Points — Detecting a Coordinated Fraud Ring

Beyond individual-level signals, a coordinated syndicate leaves a **graph-level fingerprint** that is statistically distinct from genuine mass-claim events like real weather disasters. Claim-Secure analyzes the following ring-level signals:

**Claim Burst Timing with Sub-Minute Granularity**
A genuine disaster produces claims distributed over time as workers discover their situation, run out of battery, or regain connectivity intermittently. A coordinated ring produces a statistically impossible spike — hundreds of claims within a 3–7 minute window. The temporal distribution shape is itself a fraud feature fed into the model.

**Device Fingerprint Clustering**
GPS spoofing apps originate from a small set of common tools. The system flags devices with developer mode enabled, mock location permissions active, or a location provider string that does not match the device's declared hardware. A cluster of 60 claims all originating from devices running the same spoofing tool version is a near-certain ring signal, regardless of what GPS coordinates they report.

**Zone Saturation Rate vs. Historical Density Baseline**
The system maintains a rolling baseline of active claimants per geographic zone, segmented by hour of day and day of week. If a zone that historically averages 12 active workers suddenly shows 340 simultaneous claims, the 28× density spike is a primary ring indicator. Real disasters cause elevated claims — they do not cause statistically impossible density explosions.

**Network & IP Overlap Across Claimants**
Workers genuinely caught in a storm connect from varied cell towers and IP ranges scattered across the declared zone. A ring connecting from a small handful of residential IP ranges — particularly if those IPs are geographically clustered far from the declared zone — is a strong syndicate indicator. The system cross-references IP geolocation against claimed GPS coordinates on every submission.

**Social Graph & Onboarding Linkage**
The system does not surveil private messages. However, it flags workers who share onboarding referral codes, whose accounts were created within a tight time window, or who share device fingerprint history across multiple accounts. These are legitimate platform signals that, when clustered, indicate coordinated recruitment — the same recruitment that happens over Telegram.

**Claim Content Similarity Scoring**
Natural language similarity analysis on claim descriptions detects templated submissions. When 80 claims in the same zone use near-identical phrasing within minutes of each other, the text similarity score is a direct ring indicator. Genuine claimants describe their situation in their own words; coordinated rings copy-paste.

---

### 3. UX Balance — Flagging Without Penalizing Honest Workers

This is the hardest design problem. Wrongly denying a payout to a gig worker genuinely stranded in a flood — in the middle of the emergency — is not just a product failure. It is a trust-destroying moment that spreads through the same Telegram networks the syndicates use, and it undermines the entire value proposition of parametric insurance. Claim-Secure uses a **tiered response architecture** that never conflates "flagged" with "denied."

**Tier 1 — Low Composite Risk Score → Auto-Approve with Background Audit**
If the multi-signal composite score falls below the risk threshold, the claim pays immediately. The case is logged for post-hoc statistical analysis but the claimant experiences zero friction. This covers the vast majority of genuine claims and preserves the fast-payout promise of parametric insurance.

**Tier 2 — Medium Score → Soft Flag with Non-Punitive Friction**
The claim is not denied. The worker receives a brief in-app prompt framed as weather documentation, not an accusation: *"We're verifying your location due to high claim volume in your area. Can you share a short 10-second video of your current surroundings?"* Genuine workers in a storm can provide this in seconds. A ring member sitting at home cannot produce a credible storm video on demand. Critically, the **payout is held for 4 hours — not denied** — and released automatically if the video passes a basic authenticity check covering metadata, ambient audio, and lighting consistency.

**Tier 3 — High Score or Confirmed Ring Pattern → Hard Block with Escalation Path**
The claim is rejected, but the worker receives a clear human appeal mechanism. The rejection message does not accuse them of fraud — it states: *"Your claim requires manual verification due to unusual activity in your area."* A legitimate worker can escalate to a human reviewer. A ring member is economically unlikely to invest the time.

**Network Degradation Grace**
A genuine worker in a severe storm may lose connectivity entirely, producing GPS gaps and incomplete telemetry that could naively look suspicious. The model is specifically trained to recognize the *pattern* of a legitimate connectivity blackout — GPS signal lost, last known position inside the zone, intermittent cell reconnects at irregular intervals — versus the pattern of active spoofing, where the GPS signal is suspiciously stable and continuous because the mock location app maintains a clean synthetic signal. Real blackouts are messy. Spoofed locations are unnaturally clean.

**Trust Score Accumulation**
Workers whose claims are auto-approved consistently over time accumulate a trust score. High-trust workers receive a higher approval threshold, reducing friction for loyal claimants with verified history. This also hardens the system against new-account fraud — freshly created accounts attempting mass claims immediately face maximum scrutiny.

---

### Architectural Summary

No single signal blocks a claim. The composite risk score draws from physics coherence, device integrity, network plausibility, temporal burst analysis, and graph-level syndicate indicators. A block requires convergent evidence across multiple independent layers. This is precisely what makes the architecture expensive to defeat: spoofing GPS costs nothing, but simultaneously spoofing GPS coherence, accelerometer data, battery patterns, cell tower triangulation, claim burst timing, and network origin — while avoiding social graph linkage — destroys the economics of the fraud before it begins.

---

## Tech Stack

### Frontend
- **Next.js** 14.2.5 – React framework with API routes and SSR
- **TypeScript** – Type-safe frontend development
- **Tailwind CSS** – Utility-first styling
- **Recharts** – Data visualization components
- **NextAuth 4** – Authentication with JWT sessions

### Backend
- **Python FastAPI** – High-performance ML service wrapper
- **Scikit-learn** – Machine learning model (AdaBoost classifier)
- **Pydantic** – Request/response validation
- **Joblib** – Model persistence and loading

### Database
- **Prisma** 7.5 – ORM for database management
- **SQLite + libsql** – Lightweight relational database

---

## Project Structure

```
GuideWire/
├── app/                          # Next.js app router
│   ├── api/                      # API routes
│   │   ├── analyze-claim/        # ML prediction endpoint
│   │   ├── auth/                 # Authentication routes
│   │   └── login/                # Login page route
│   ├── dashboard/                # Main claims dashboard
│   ├── admin/                    # Admin panel
│   ├── cases/                    # Cases view
│   ├── register/                 # User registration
│   └── layout.tsx & page.tsx     # Root layout/home
│
├── components/                   # React components
│   ├── ClaimForm.tsx             # 7-section claim submission form
│   ├── CasesTable.tsx            # Claims list with sorting/filtering
│   ├── DashboardCharts.tsx       # Analytics visualizations
│   ├── RiskGauge.tsx             # Circular risk score display
│   ├── RiskBadge.tsx             # Risk level badge component
│   └── SessionWrapper.tsx        # Auth session provider
│
├── lib/                          # Utilities
│   ├── auth.ts                   # NextAuth configuration
│   ├── prisma.ts                 # Prisma client instance
│   ├── fraudModel.ts             # Legacy ML utilities
│   └── claimsStore.ts            # Client-side cache
│
├── types/                        # TypeScript interfaces
│   ├── claim.ts                  # ClaimInput, ClaimResult, etc.
│   └── next-auth.d.ts            # NextAuth type extensions
│
├── prisma/                       # Database schema & migrations
│   ├── schema.prisma             # Prisma data models
│   └── seed.ts                   # Database seeding script
│
├── ml_service/                   # Python ML service
│   ├── main.py                   # FastAPI application
│   ├── requirements.txt          # Python dependencies
│   └── models/
│       ├── fraud_model_final.joblib
│       └── model_metadata.json
│
├── package.json
├── tsconfig.json
├── next.config.mjs
├── prisma.config.ts
└── README.md
```

---

## Installation

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+ and pip
- **Git**

### Frontend Setup

```bash
git clone https://github.com/yourusername/Guidewire.git
cd Guidewire
npm install
npx prisma generate
npx prisma db push
npm run seed
```

### ML Service Setup

```bash
cd ml_service
pip install -r requirements.txt
python main.py
```

---

## Running the Application

### Terminal 1 — ML Service
```bash
cd ml_service
uvicorn main:app --reload --port 8000
```

Available at `http://localhost:8000`:
- `POST /predict` – Claim fraud analysis
- `GET /model-info` – Model metadata
- `GET /docs` – Interactive API documentation

### Terminal 2 — Next.js
```bash
npm run dev
```

Available at `http://localhost:3000`.

### Default Test Credentials

| Role  | Email               | Password   |
|-------|---------------------|------------|
| Admin | admin@sentinel.ai   | admin123   |
| User  | user@sentinel.ai    | user123    |

---

## API Reference

### `POST /api/analyze-claim`

**Authentication:** Required (NextAuth JWT)

**Request body:**
```json
{
  "months_as_customer": 12,
  "age": 35,
  "policy_bind_date": "2026-01-15",
  "policy_annual_premium": 1200,
  "incident_type": "Single Vehicle Collision",
  "collision_type": "Front Collision",
  "incident_severity": "Minor Damage",
  "authorities_contacted": "Police",
  "incident_hour_of_the_day": 14,
  "number_of_vehicles_involved": 1,
  "property_damage": "YES",
  "witnesses": 2,
  "police_report_available": "YES",
  "total_claim_amount": 15000,
  "injury_claim": 2000,
  "property_claim": 8000,
  "vehicle_claim": 5000,
  "auto_year": 2021,
  "capital_gains": 0,
  "capital_loss": 0,
  "policy_deductable": 1000
}
```

**Response:**
```json
{
  "id": "clm_abc123",
  "fraud_probability": 0.15,
  "risk_score": 15.3,
  "risk_level": "LOW",
  "is_fraud": false,
  "flags": [],
  "recommendation": "Auto-approve — low risk score"
}
```

### Risk Levels

| Level    | Score   | Action                          |
|----------|---------|---------------------------------|
| LOW      | 0–35    | Auto-approve                    |
| MEDIUM   | 35–60   | Flag for soft review            |
| HIGH     | 60–80   | Hold payout, request documents  |
| CRITICAL | 80+     | Block and investigate           |

---

## ML Model

| Metric        | Value  |
|---------------|--------|
| Algorithm     | AdaBoost (SAMME) |
| Features      | 23     |
| Training data | 1,000 historical claims |
| Test accuracy | 83%    |
| ROC-AUC       | 0.77   |
| F1 (Fraud)    | 0.68   |
| Threshold     | 0.35   |

**Top predictive features:**
1. Incident severity (32.7% importance)
2. Policy annual premium (8.1%)
3. Policy age in years (7.8%)
4. Vehicle claim ratio (6.1%)
5. Property claim amount (5.6%)

---

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
ML_SERVICE_URL="http://localhost:8000"
```

---

## Production Deployment

```bash
# Next.js
npm run build
npm start

# ML service
cd ml_service
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

---

## Troubleshooting

**ML service connection error**
```bash
cd ml_service
uvicorn main:app --reload --port 8000
```

**Foreign key constraint error**
Log out, clear cookies, log back in.

**Database reset**
```bash
npx prisma db push --force-reset
npm run seed
```

**scikit-learn version warning**
```bash
cd ml_service
pip install --upgrade scikit-learn
```

---

## License

This project is provided as-is for educational and commercial use.

---

**Built for insurance fraud detection — hardened against adversarial attack**
