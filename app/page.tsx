import ClaimForm from "@/components/ClaimForm";

export default function Home() {
  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">
          Claim Submission
        </p>
        <h1 className="text-3xl font-bold text-text">
          Submit a New Claim
        </h1>
        <p className="text-text-dim mt-2 max-w-xl">
          All claims are scored in real-time by our multi-signal fraud detection model before being queued for review.
        </p>
      </div>
      <ClaimForm />
    </div>
  );
}