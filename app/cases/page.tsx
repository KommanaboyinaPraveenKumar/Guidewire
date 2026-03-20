import CasesTable from "@/components/CasesTable";
import { getAllClaims } from "@/lib/claimsStore";

export default function CasesPage() {
  const claims = getAllClaims();
  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">
          Case Management
        </p>
        <h1 className="text-3xl font-bold text-text">All Claims</h1>
        <p className="text-text-dim mt-2">{claims.length} claims in system</p>
      </div>
      <CasesTable claims={claims} />
    </div>
  );
}