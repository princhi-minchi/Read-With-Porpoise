import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();
  if (!text || !language) {
    return NextResponse.json({ error: "text and language required" }, { status: 400 });
  }

  const url = new URL("https://api.babelscape.com/v1/nlp-pipeline/query");
  url.searchParams.set("key", process.env.BABELSCAPE_API_KEY!);
  url.searchParams.set("text", text);
  url.searchParams.set("language", language);

  const babelRes = await fetch(url.toString(), { method: "POST" });
  if (!babelRes.ok) {
    return NextResponse.json({ error: "Babelscape error" }, { status: 502 });
  }

  const data = await babelRes.json();

  // Cache individual lemmas — fire and forget, do not await
  const supabase = await createClient();
  for (const sentence of data.sentences ?? []) {
    for (const token of sentence.tokens ?? []) {
      if (!token.morph?.lemma) continue;
      supabase.from("lemma_cache").upsert(
        {
          lemma: token.morph.lemma,
          language,
          pos: token.pos,
          morph_data: token.morph,
        },
        { onConflict: "lemma,language", ignoreDuplicates: true }
      );
    }
  }

  return NextResponse.json(data);
}
