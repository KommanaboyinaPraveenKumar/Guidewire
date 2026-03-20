export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ClaimInput {
  months_as_customer: number;
  age: number;
  policy_bind_date: string;           // "YYYY-MM-DD"
  policy_annual_premium: number;
  umbrella_limit?: number;
  incident_type: string;              // "Single Vehicle Collision" etc
  collision_type: string;             // "Front Collision" etc
  incident_severity: string;          // "Minor Damage" etc
  authorities_contacted: string;      // "Police" etc
  incident_hour_of_the_day: number;
  number_of_vehicles_involved: number;
  property_damage: string;            // "YES" / "NO" / "?"
  bodily_injuries?: number;
  witnesses: number;
  police_report_available: string;    // "YES" / "NO" / "?"
  total_claim_amount: number;
  injury_claim: number;
  property_claim: number;
  vehicle_claim: number;
  auto_year: number;
  capital_gains?: number;
  capital_loss?: number;
  policy_deductable?: number;
}

export interface MLPredictionResponse {
  fraud_probability: number;
  risk_score: number;
  risk_level: RiskLevel;
  is_fraud: boolean;
  flags: string[];
  recommendation: string;
  model: string;
  threshold: number;
}

export interface ClaimResult extends MLPredictionResponse, ClaimInput {
  id: string;
  timestamp: string;
}