import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward to ML service
    const mlResponse = await fetch("http://localhost:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!mlResponse.ok) {
      const error = await mlResponse.text();
      return NextResponse.json({ error: `ML service error: ${error}` }, { status: mlResponse.status });
    }

    const result = await mlResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze claim error:", error);
    return NextResponse.json({ error: "Failed to analyze claim" }, { status: 500 });
  }
}