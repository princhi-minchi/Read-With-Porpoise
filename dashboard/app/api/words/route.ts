import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language");
  const pos = searchParams.get("pos");
  const dueForReview = searchParams.get("due_for_review") === "true";

  let query = supabase
    .from("saved_words")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (language) query = query.eq("language", language);
  if (pos) query = query.eq("pos", pos);
  if (dueForReview) query = query.lte("next_review_at", new Date().toISOString());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ words: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lemma, rawText, language, pos, contextSentence, translationEn, morphData } =
    await req.json();

  const { data: word, error } = await supabase
    .from("saved_words")
    .insert({
      user_id: user.id,
      lemma,
      raw_text: rawText,
      language,
      pos,
      context_sentence: contextSentence,
      translation_en: translationEn,
      morph_data: morphData,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.rpc("increment_user_stats", { user_id_param: user.id });

  return NextResponse.json({ word });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("saved_words").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, nextReviewAt, reviewIntervalDays, easeFactor } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("saved_words")
    .update({
      next_review_at: nextReviewAt,
      review_interval_days: reviewIntervalDays,
      ease_factor: easeFactor,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
