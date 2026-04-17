import { NextRequest, NextResponse } from "next/server";
import { lookupConjugation } from "@/lib/cloudflare/kv";

export async function POST(req: NextRequest) {
  const { wordForm, language } = await req.json();
  if (!wordForm || !language) {
    return NextResponse.json({ error: "wordForm and language required" }, { status: 400 });
  }

  const result = await lookupConjugation(wordForm, language);
  if (!result) {
    return NextResponse.json({ error: "Conjugation not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
