import { NextResponse } from "next/server";
import { generateMindMap } from "@/lib/anthropicAssistant";

export async function POST(request: Request) {
  let body: { subjectContext?: string; sourceText?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sourceText || typeof body.sourceText !== "string") {
    return NextResponse.json({ error: "sourceText is required" }, { status: 400 });
  }

  try {
    const mindMap = await generateMindMap(
      body.subjectContext ?? "general",
      body.sourceText,
      body.apiKey,
    );
    return NextResponse.json(mindMap);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mind map generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
