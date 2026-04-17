from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import json
import numpy as np
import os
from datetime import datetime
from sklearn.linear_model import LogisticRegression

app = FastAPI(title="MediGuard Fraud Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model & metadata on startup ─────────────────────────────────────
BASE = os.path.dirname(__file__)
model = joblib.load(os.path.join(BASE, "models", "fraud_model_final.joblib"))
with open(os.path.join(BASE, "models", "model_metadata.json")) as f:
    metadata = json.load(f)

THRESHOLD   = metadata["threshold"]
FEATURES    = metadata["features"]
ENCODINGS   = metadata["feature_encodings"]


def train_income_claim_model() -> LogisticRegression:
    rng = np.random.default_rng(42)
    sample_size = 4000

    zone_mismatch = rng.binomial(1, 0.12, sample_size)
    payout_ratio = rng.uniform(0.12, 1.2, sample_size)
    recent_claim_count = np.clip(rng.poisson(1.4, sample_size), 0, 6)
    trust_score = rng.uniform(0.45, 0.95, sample_size)
    trigger_severity = rng.integers(0, 4, sample_size)
    impact_hours = rng.uniform(2, 14, sample_size)
    payout_vs_income = np.clip(rng.normal(0.25, 0.18, sample_size), 0, 1.2)
    gps_mismatch = rng.binomial(1, 0.08, sample_size)
    off_shift = rng.binomial(1, 0.15, sample_size)

    logits = (
        -2.2
        + 2.0 * zone_mismatch
        + 1.8 * payout_ratio
        + 0.22 * recent_claim_count
        + 1.5 * (1 - trust_score)
        + 0.35 * trigger_severity
        + 0.18 * np.clip(impact_hours / 10, 0, 1.5)
        + 0.6 * payout_vs_income
        + 2.5 * gps_mismatch
        + 1.8 * off_shift
        + rng.normal(0, 0.35, sample_size)
    )
    probabilities = 1 / (1 + np.exp(-logits))
    labels = (rng.random(sample_size) < probabilities).astype(int)

    features = np.column_stack([
        zone_mismatch,
        payout_ratio,
        recent_claim_count,
        trust_score,
        trigger_severity,
        impact_hours,
        payout_vs_income,
        gps_mismatch,
        off_shift
    ])

    model = LogisticRegression(max_iter=400)
    model.fit(features, labels)
    return model


income_claim_model = train_income_claim_model()

print(f"Model loaded: {metadata['model_type']}")
print(f"Threshold: {THRESHOLD}")
print(f"Features: {len(FEATURES)}")
print("Income claim ML model: logistic_regression_v1")

# ── Request schema ────────────────────────────────────────────────────────
class ClaimRequest(BaseModel):
    months_as_customer: float
    age: float
    policy_bind_date: str          # "YYYY-MM-DD"
    policy_annual_premium: float
    umbrella_limit: float = 0
    incident_type: str             # "Single Vehicle Collision" etc
    collision_type: str            # "Front Collision" etc
    incident_severity: str         # "Minor Damage" etc
    authorities_contacted: str     # "Police" etc
    incident_hour_of_the_day: float
    number_of_vehicles_involved: float
    property_damage: str           # "YES" / "NO" / "?"
    bodily_injuries: float = 0
    witnesses: float
    police_report_available: str   # "YES" / "NO" / "?"
    total_claim_amount: float
    injury_claim: float
    property_claim: float
    vehicle_claim: float
    auto_year: float
    capital_gains: float = 0
    capital_loss: float = 0
    policy_deductable: float = 1000


class IncomeClaimFraudRequest(BaseModel):
    zone_match: bool
    payout_ratio: float
    recent_claim_count: int
    trust_score: float
    trigger_severity: str
    impact_hours: float
    weekly_income: float
    approved_payout: float
    gps_verified: bool = True
    on_shift_at_time: bool = True


class RetrainRequest(BaseModel):
    claims: list[IncomeClaimFraudRequest]
    labels: list[int]  # 1 for fraud/rejected, 0 for legitimate/approved


def to_risk_level(score: float) -> str:
    return (
        "CRITICAL" if score >= 80 else
        "HIGH" if score >= 60 else
        "MEDIUM" if score >= 35 else
        "LOW"
    )


def build_income_claim_features(req: IncomeClaimFraudRequest) -> np.ndarray:
    severity_map = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    severity_encoded = severity_map.get(req.trigger_severity.upper(), 1)

    zone_mismatch = 0 if req.zone_match else 1
    payout_ratio = float(np.clip(req.payout_ratio, 0, 2))
    recent_claim_count = int(np.clip(req.recent_claim_count, 0, 8))
    trust_score = float(np.clip(req.trust_score, 0, 1))
    impact_hours = float(np.clip(req.impact_hours, 0, 24))
    payout_vs_income = float(np.clip(req.approved_payout / max(req.weekly_income, 1), 0, 2))
    gps_mismatch = 0 if req.gps_verified else 1
    off_shift = 0 if req.on_shift_at_time else 1

    return np.array([[zone_mismatch, payout_ratio, recent_claim_count, trust_score, severity_encoded, impact_hours, payout_vs_income, gps_mismatch, off_shift]])

# ── Feature engineering (mirrors Colab preprocessing) ────────────────────
def build_feature_vector(req: ClaimRequest) -> np.ndarray:
    try:
        bind_date = datetime.strptime(req.policy_bind_date, "%Y-%m-%d")
        policy_age_years = (datetime(2015, 3, 1) - bind_date).days / 365
    except Exception:
        policy_age_years = 5.0

    total = req.total_claim_amount + 1
    injury_ratio   = req.injury_claim   / total
    vehicle_ratio  = req.vehicle_claim  / total
    property_ratio = req.property_claim / total

    incident_severity_encoded = ENCODINGS["incident_severity"].get(req.incident_severity, 1)
    authorities_encoded       = ENCODINGS["authorities_contacted"].get(req.authorities_contacted, 1)
    police_report_encoded     = ENCODINGS["police_report_available"].get(req.police_report_available, -1)
    property_damage_encoded   = ENCODINGS["property_damage"].get(req.property_damage, -1)
    collision_encoded         = ENCODINGS["collision_type"].get(req.collision_type, 0)
    incident_type_encoded     = ENCODINGS["incident_type"].get(req.incident_type, 0)

    vector = {
        "incident_severity_encoded":    incident_severity_encoded,
        "policy_annual_premium":        req.policy_annual_premium,
        "policy_age_years":             policy_age_years,
        "vehicle_ratio":                vehicle_ratio,
        "property_claim":               req.property_claim,
        "injury_ratio":                 injury_ratio,
        "months_as_customer":           req.months_as_customer,
        "vehicle_claim":                req.vehicle_claim,
        "capital-gains":                req.capital_gains,
        "incident_hour_of_the_day":     req.incident_hour_of_the_day,
        "injury_claim":                 req.injury_claim,
        "total_claim_amount":           req.total_claim_amount,
        "auto_year":                    req.auto_year,
        "capital-loss":                 req.capital_loss,
        "age":                          req.age,
        "witnesses":                    req.witnesses,
        "police_report_encoded":        police_report_encoded,
        "authorities_encoded":          authorities_encoded,
        "number_of_vehicles_involved":  req.number_of_vehicles_involved,
        "property_damage_encoded":      property_damage_encoded,
        "incident_type_encoded":        incident_type_encoded,
        "policy_deductable":            req.policy_deductable,
        "collision_encoded":            collision_encoded,
    }

    return np.array([[vector[f] for f in FEATURES]])

# ── Flag generator ────────────────────────────────────────────────────────
def generate_flags(req: ClaimRequest, fraud_prob: float) -> list[str]:
    flags = []
    if req.incident_severity == "Major Damage":
        flags.append("Major damage claimed — highest fraud risk category (60.5% fraud rate)")
    if req.police_report_available in ["NO", "?"]:
        flags.append("No police report available")
    if req.property_damage == "?":
        flags.append("Property damage status unknown")
    if req.total_claim_amount > 80000:
        flags.append(f"High claim amount: ${req.total_claim_amount:,.0f}")
    if req.witnesses == 0:
        flags.append("No witnesses reported")
    if req.vehicle_claim / (req.total_claim_amount + 1) > 0.8:
        flags.append("Vehicle claim is >80% of total — possible inflation")
    if req.months_as_customer < 12:
        flags.append("Customer for less than 1 year")
    if req.authorities_contacted in ["Other", "Fire"]:
        flags.append(f"Unusual authority contacted: {req.authorities_contacted}")
    if req.incident_type == "Vehicle Theft" and req.police_report_available == "NO":
        flags.append("Vehicle theft with no police report — high suspicion")
    return flags

# ── Routes ────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "Fraud Detection ML API",
        "model": metadata["model_type"],
        "accuracy": metadata["performance"]["accuracy"],
        "auc": metadata["performance"]["test_auc"],
        "status": "running"
    }

@app.post("/predict")
def predict(req: ClaimRequest):
    try:
        X = build_feature_vector(req)
        fraud_prob = float(model.predict_proba(X)[0][1])
        is_fraud   = fraud_prob >= THRESHOLD
        risk_score = round(fraud_prob * 100, 1)
        risk_level = to_risk_level(risk_score)

        recommendation = {
            "CRITICAL": "Block immediately — refer to fraud investigation team",
            "HIGH":     "Hold payout — request supporting documents and manual review",
            "MEDIUM":   "Flag for soft review — verify claim details",
            "LOW":      "Auto-approve — low risk score",
        }[risk_level]

        flags = generate_flags(req, fraud_prob)

        return {
            "fraud_probability": round(fraud_prob, 4),
            "risk_score":        risk_score,
            "risk_level":        risk_level,
            "is_fraud":          is_fraud,
            "flags":             flags,
            "recommendation":    recommendation,
            "model":             metadata["model_type"],
            "threshold":         THRESHOLD,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model-info")
def model_info():
    return metadata


@app.post("/score-income-claim")
def score_income_claim(req: IncomeClaimFraudRequest):
    try:
        features = build_income_claim_features(req)
        fraud_prob = float(income_claim_model.predict_proba(features)[0][1])
        risk_score = round(fraud_prob * 100, 1)
        risk_level = to_risk_level(risk_score)

        flags: list[str] = []
        if not req.zone_match:
            flags.append("Trigger zone mismatch with worker operating zone")
        if req.payout_ratio > 0.9:
            flags.append("Payout is near weekly coverage limit")
        if req.recent_claim_count >= 2:
            flags.append("Multiple claims submitted in the last 7 days")
        if req.trust_score < 0.62:
            flags.append("Low-trust profile requires stronger validation")
        if req.trigger_severity.upper() == "CRITICAL":
            flags.append("Critical trigger severity increases fraud screening strictness")
        if not req.gps_verified:
            flags.append("ANOMALY: GPS location mismatch with trigger zone")
        if not req.on_shift_at_time:
            flags.append("ANOMALY: Worker was not recorded as on-shift during disruption")
        if len(flags) == 0:
            flags.append("No major anomalies detected across live scoring features")

        validation_summary = (
            "Claim held for manual review due to elevated ML fraud risk."
            if risk_score >= 70
            else "Claim passed ML fraud screening and remains eligible for automated payout flow."
        )

        return {
            "fraud_probability": round(fraud_prob, 4),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "flags": flags,
            "validation_summary": validation_summary,
            "model": "logistic_regression_income_claim_v1",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/retrain-income-model")
def retrain_income_model(req: RetrainRequest):
    global income_claim_model
    try:
        # Convert incoming real historical claims into feature arrays
        if len(req.claims) < 10:
            raise HTTPException(status_code=400, detail="Need at least 10 claims to retrain effectively.")
        
        real_features = np.vstack([build_income_claim_features(claim)[0] for claim in req.claims])
        real_labels = np.array(req.labels)

        # In a real production system, you'd save this to a database and combine with past data.
        # For now, we'll retrain the Logistic Regression model simply using the new real data batch
        # (or combine it with synthetic data if the real dataset is still too small).
        
        # Fit the new model 
        new_model = LogisticRegression(max_iter=400)
        new_model.fit(real_features, real_labels)
        
        # Update the live model in memory
        income_claim_model = new_model
        
        return {
            "status": "success",
            "message": f"Model retrained successfully on {len(req.claims)} real historical claims.",
            "model": "logistic_regression_income_claim_v2_real_data"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
