import type { RiskLevel } from "@/types/claim";

export interface ModelWeights {
  gpsConsistency: number;
  deviceIntegrity: number;
  claimBurstScore: number;
  networkOverlap: number;
  motionCoherence: number;
  normalizedAmount: number;
  priorClaimsRate: number;
  descriptionLen: number;
  bias: number;
}

// Default weights (used if DB has no trained weights yet)
export const DEFAULT_WEIGHTS: ModelWeights = {
  gpsConsistency:  -2.8,
  deviceIntegrity: -3.1,
  claimBurstScore:  3.6,
  networkOverlap:   3.2,
  motionCoherence: -2.4,
  normalizedAmount: 1.7,
  priorClaimsRate:  2.1,
  descriptionLen:  -0.9,
  bias:             0.3,
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export interface ScoreInput {
  gpsConsistency: number;
  deviceIntegrity: number;
  claimBurstScore: number;
  networkOverlap: number;
  motionCoherence: number;
  amount: number;
  priorClaims: number;
  description: string;
}

export function scoreWithWeights(
  input: ScoreInput,
  weights: ModelWeights
): { riskScore: number; riskLevel: RiskLevel; flags: string[]; recommendation: string } {
  const normalizedAmount = normalize(input.amount, 0, 50000);
  const priorClaimsRate = normalize(input.priorClaims, 0, 10);
  const descriptionLen = normalize(input.description.length, 0, 500);

  const logit =
    weights.gpsConsistency * input.gpsConsistency +
    weights.deviceIntegrity * input.deviceIntegrity +
    weights.claimBurstScore * input.claimBurstScore +
    weights.networkOverlap * input.networkOverlap +
    weights.motionCoherence * input.motionCoherence +
    weights.normalizedAmount * normalizedAmount +
    weights.priorClaimsRate * priorClaimsRate +
    weights.descriptionLen * descriptionLen +
    weights.bias;

  const riskScore = Math.round(sigmoid(logit) * 100);

  const riskLevel: RiskLevel =
    riskScore >= 80 ? "CRITICAL" :
    riskScore >= 60 ? "HIGH" :
    riskScore >= 35 ? "MEDIUM" : "LOW";

  const flags: string[] = [];
  if (input.gpsConsistency < 0.4)   flags.push("GPS signal inconsistent or spoofed");
  if (input.deviceIntegrity < 0.5)  flags.push("Mock location or rooted device detected");
  if (input.claimBurstScore > 0.6)  flags.push("High claim burst rate in zone");
  if (input.networkOverlap > 0.5)   flags.push("IP/network overlap with other claimants");
  if (input.motionCoherence < 0.4)  flags.push("Motion data inconsistent with claim");
  if (input.priorClaims > 4)        flags.push(`${input.priorClaims} prior claims on record`);
  if (input.amount > 20000)         flags.push("Unusually high claim amount");
  if (input.description.length < 40) flags.push("Description too brief");

  const recommendation =
    riskLevel === "CRITICAL" ? "Block immediately — refer to fraud investigation team" :
    riskLevel === "HIGH"     ? "Hold payout — request video verification and manual review" :
    riskLevel === "MEDIUM"   ? "Flag for soft review — verify supporting documents" :
                               "Auto-approve — low risk composite score";

  return { riskScore, riskLevel, flags, recommendation };
}

// Logistic regression training using gradient descent
export function trainModel(
  samples: Array<{ input: ScoreInput; label: number }>,
  currentWeights: ModelWeights,
  learningRate = 0.01,
  epochs = 200
): ModelWeights {
  let w = { ...currentWeights };

  for (let e = 0; e < epochs; e++) {
    const grad: ModelWeights = {
      gpsConsistency: 0, deviceIntegrity: 0, claimBurstScore: 0,
      networkOverlap: 0, motionCoherence: 0, normalizedAmount: 0,
      priorClaimsRate: 0, descriptionLen: 0, bias: 0,
    };

    for (const { input, label } of samples) {
      const { riskScore } = scoreWithWeights(input, w);
      const pred = riskScore / 100;
      const error = pred - label;

      grad.gpsConsistency  += error * input.gpsConsistency;
      grad.deviceIntegrity += error * input.deviceIntegrity;
      grad.claimBurstScore += error * input.claimBurstScore;
      grad.networkOverlap  += error * input.networkOverlap;
      grad.motionCoherence += error * input.motionCoherence;
      grad.normalizedAmount += error * normalize(input.amount, 0, 50000);
      grad.priorClaimsRate  += error * normalize(input.priorClaims, 0, 10);
      grad.descriptionLen   += error * normalize(input.description.length, 0, 500);
      grad.bias += error;
    }

    const n = samples.length;
    (Object.keys(grad) as (keyof ModelWeights)[]).forEach((k) => {
      w[k] -= (learningRate * grad[k]) / n;
    });
  }

  return w;
}