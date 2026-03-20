from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import json
import numpy as np
import os
from datetime import datetime

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

print(f"Model loaded: {metadata['model_type']}")
print(f"Threshold: {THRESHOLD}")
print(f"Features: {len(FEATURES)}")

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

        risk_level = (
            "CRITICAL" if risk_score >= 80 else
            "HIGH"     if risk_score >= 60 else
            "MEDIUM"   if risk_score >= 35 else
            "LOW"
        )

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