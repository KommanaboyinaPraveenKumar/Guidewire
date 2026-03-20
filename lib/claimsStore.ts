import type { ClaimResult } from "@/types/claim";

// In-memory cache (actual data comes from Prisma DB via API)
let cachedClaims: ClaimResult[] = [];

export function getAllClaims(): ClaimResult[] {
  // Return cached claims, sorted by timestamp
  return [...cachedClaims].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function setClaims(claims: ClaimResult[]): void {
  cachedClaims = claims;
}

export function addClaim(claim: ClaimResult): void {
  cachedClaims.unshift(claim);
}