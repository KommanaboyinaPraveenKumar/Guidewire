
# Claim-Secure

An intelligent, zero-touch parametric insurance platform designed specifically to protect gig economy workers from localized income loss due to weather anomalies and civic disruptions. 

## 🎯 Core Strategy
Our mission is to shift the insurance paradigm from **reactive and manual** to **proactive and automated**. Gig workers (delivery partners, ride-share drivers) live on daily wages. When a flood or heatwave hits, they cannot afford a 30-day claims process. Our platform monitors live environmental triggers and auto-initiates instant payouts, backed by an advanced AI/ML fraud detection pipeline to protect the liquidity pool.

---

## 👥 Personas, Scenarios, and Workflow

### 1. Ravi - The Gig Worker (User Persona)
* **Scenario:** Ravi is a delivery partner in Indiranagar, Bengaluru. A severe rainstorm floods the zone, halting all deliveries. 
* **Workflow:** Ravi does absolutely nothing. The platform webhook detects the flood in his operating zone. It automatically initiates a claim on his behalf, validates that his GPS matches the zone and that he was marked "on-shift," and instantly credits his UPI ID with the covered income loss amount.

### 2. Sarah - The Insurance Operator (Admin Persona)
* **Scenario:** A fraudulent syndicate attempts to spoof their GPS to claim payouts during a declared disruption in a different city.
* **Workflow:** The ML engine flags the incoming claims with anomalies (`"ANOMALY: Worker was not recorded as on-shift during disruption"` and `"ANOMALY: GPS location mismatch"`). The claims bypass the auto-payout and are routed to Sarahs Admin Dashboard. She reviews the high fraud score (82/100) and clicks **Block Claim**, which automatically slashes the syndicate accounts Trust Scores.

---

## 💸 Premium Model & Parametric Triggers

### Dynamic Weekly Premium Model
The platform utilizes a **Micro-Weekly Premium Model** tailored to the cash flow of gig workers. 
Rather than a flat annual fee, the weekly premium is mathematically calculated at checkout combining:
1. **Base Coverage:** The amount of daily income the worker wants to insure.
2. **Zone Risk:** Historical baseline risk of the workers selected operating zone.
3. **Trust Score:** A dynamic multiplier ranging from 0.0 to 1.0. A worker who maintains a legitimate history gets cheaper premiums. If claims are manually rejected for fraud, their Trust Score drops, immediately spiking their next weekly premium quote.

### Parametric Triggers
Parametric triggers are objective, binary, third-party data points that automatically execute contracts. We utilize:
* **Open-Meteo Forecast APIs:** Triggering payouts if Rainfall exceeds 50mm/hr or Temperatures cross 42°C.
* **Open-Meteo AQI APIs:** Trigger payouts for hazardous smog (PM 2.5 > 300).
* **Platform APIs (Simulated):** Traffic jams, metro strikes, or internet blackouts reported by civic authorities.

---

## 📱 Web vs. Mobile Platform Justification

**Our Choice: Progressive Web Application (PWA) / Responsive Web Platform.**

**Justification:** 
Gig workers are constantly running battery-heavy and memory-heavy apps on low-end Android devices (e.g., Swiggy, Uber, Google Maps). Forcing them to install an additional 80MB native Insurance App creates massive friction and battery drain. 
By building a highly responsive Next.js Web App, workers can register a policy directly from a browser link in 30 seconds with 0 bytes of installation required. Meanwhile, the web platform scales perfectly for Insurance Admins who require large desktop monitors to review complex data dashboards and manage fleet metrics.

---

## 🧠 AI / ML Integration

Our architecture implements AI/ML at two critical junctions:

1. **Intelligent Fraud Detection Pipeline (Python FastAPI / Scikit-Learn)**
   * When an auto-claim is generated, it immediately hits our Python ML endpoint (`/score-income-claim`).
   * A pre-trained `LogisticRegression` model processes the claim against 9 unique features (e.g., `payout_ratio`, `recent_claim_count`, `gps_mismatch`, `off_shift_anomaly`, `trust_score`).
   * The model returns a Risk Score (0-100). Low scores auto-approve to the Payment Gateway. High scores are blocked and routed to a human Admin.
   * **Continuous Learning:** The ML pipeline includes a `/retrain-income-model` webhook. While initially trained on synthetic data, the platform continuously collects real-world human-audited claims and automatically retrains the model (triggering after every 10 new logged claims) to adapt to new fraud patterns.

2. **Dynamic Trust Scoring & Premium Calculation**
   * The system features an algorithmic feedback loop. When the Admin blocks a fraudulent claim, the backend automatically triggers `refreshTrustScoreForUser`. The workers trust score degrades, signaling the `calculateWeeklyQuote` engine to charge them a higher premium to offset the newly discovered risk to the pool.

---

## 🛠️ Tech Stack & Development Plan

### Tech Stack
* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons.
* **Backend:** Next.js API Routes, NextAuth.js (Role-based authentication).
* **Database & ORM:** SQLite (Development) -> PostgreSQL (Production), Prisma Client.
* **ML Service:** Python 3, FastAPI, NumPy, Scikit-Learn, Joblib.
* **External Integrations:** 
  * Location: CountriesNow API, PostalPincode API.
  * Triggers: Open-Meteo Weather & AQI APIs.
  * Payouts: RazorpayX (via API).

### Development Plan
* [x] **Phase 1: Core Systems:** NextAuth user/admin routing, database schema generation, basic onboarding form.
* [x] **Phase 2: External API Hookups:** Live city/timezone dropdowns, integration with Open-Meteo for live disruption generation. 
* [x] **Phase 3: Machine Learning Microservice:** Build, train, and host the Python ML models. Connect the frontend Next.js backend to the FastAPI inference endpoints.
* [x] **Phase 4: Parametric Automation:** Implement the zero-touch auto-claim generation for policyholders matching localized triggers.
* [x] **Phase 5: Manual Claim Submission:** Added UI for manual claim analysis with fraud detection.
* [ ] **Phase 6 (Future): Hardening:** Migrate SQLite to PostgreSQL, transition RazorpayX from Sandbox to Live production, and integrate physical GPS pinging.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd fraud-detection
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

4. **Install ML service dependencies:**
   ```bash
   cd ml_service
   pip install -r requirements.txt
   cd ..
   ```

5. **Configure environment variables:**
   Create `.env.local` in the root directory:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Optional: For live weather triggers
   USE_REAL_TRIGGERS=true
   OPENWEATHER_API_KEY=your-openweather-key
   AQICN_API_TOKEN=your-aqicn-token
   ```

### Running the Application

1. **Start the ML service:**
   ```bash
   cd ml_service
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the frontend (in a new terminal):**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - ML API: http://localhost:8000

### Key Features Implemented

- **User Authentication:** Role-based login (admin/worker)
- **Dashboard:** Real-time metrics, active triggers, claim status
- **Automated Claims:** Zero-touch payouts based on live weather triggers
- **Manual Claim Analysis:** Submit claims for ML-powered fraud detection
- **Admin Panel:** Review flagged claims, manage policies
- **External API Integration:** Live weather and air quality data
- **ML Fraud Detection:** Trained on synthetic data with continuous learning

---

## 📊 API Endpoints

### Frontend API Routes
- `GET /api/dashboard` - User dashboard data
- `GET/POST /api/claims` - Claim management
- `POST /api/analyze-claim` - Manual claim fraud analysis
- `POST /api/policy` - Policy creation
- `POST /api/register` - User registration

### ML Service Endpoints
- `GET /` - Service health check
- `POST /predict` - Fraud prediction for claims
- `POST /score-income-claim` - Income claim fraud scoring
- `POST /retrain-income-model` - Model retraining

---

## 🔧 Configuration

### Environment Variables
- `USE_REAL_TRIGGERS`: Enable live weather API triggers (default: false)
- `OPENWEATHER_API_KEY`: OpenWeather API key for weather data
- `AQICN_API_TOKEN`: AQICN API token for air quality data
- `DATABASE_URL`: Database connection string

### ML Model
The fraud detection model is trained on synthetic data and includes:
- 9 key features for income claim analysis
- Risk scoring (0-100 scale)
- Continuous retraining capability

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License.

