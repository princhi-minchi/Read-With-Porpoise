import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, sourceLang } = await req.json();
  if (!text || !sourceLang) {
    return NextResponse.json({ error: "text and sourceLang required" }, { status: 400 });
  }

  const body = new URLSearchParams({
    text,
    source_lang: sourceLang,
    target_lang: "EN",
  });

  const deeplRes = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY!}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!deeplRes.ok) {
    return NextResponse.json({ error: "DeepL error" }, { status: 502 });
  }

  const data = await deeplRes.json();
  const translation = data.translations?.[0]?.text ?? "";
  return NextResponse.json({ translation });
}
