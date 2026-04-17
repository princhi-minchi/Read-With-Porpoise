import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function getAuthenticatedClient(req: NextRequest): Promise<SupabaseClient | null> {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      }
    );
    const { data: { user } } = await client.auth.getUser();
    return user ? client : null;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function GET(req: NextRequest) {
  const supabase = await getAuthenticatedClient(req);
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language");
  const pos = searchParams.get("pos");
  const dueForReview = searchParams.get("due_for_review") === "true";

  let query = supabase
    .from("saved_words")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  if (language) query = query.eq("language", language);
  if (pos) query = query.eq("pos", pos);
  if (dueForReview) query = query.lte("next_review_at", new Date().toISOString());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ words: data });
}

export async function POST(req: NextRequest) {
  const supabase = await getAuthenticatedClient(req);
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  const { lemma, rawText, language, pos, contextSentence, translationEn, morphData } =
    await req.json();

  const { data: word, error } = await supabase
    .from("saved_words")
    .insert({
      user_id: user!.id,
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

  await supabase.rpc("increment_user_stats", { user_id_param: user!.id });

  return NextResponse.json({ word });
}

export async function DELETE(req: NextRequest) {
  const supabase = await getAuthenticatedClient(req);
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("saved_words").delete().eq("id", id).eq("user_id", user!.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = await getAuthenticatedClient(req);
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser();
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
    .eq("user_id", user!.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
