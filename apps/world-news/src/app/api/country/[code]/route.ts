import { NextResponse } from "next/server";
import { getCountryNews, UnknownCountryError } from "@/lib/news";
import { MissingApiKeyError } from "@/lib/gemini";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  try {
    const news = await getCountryNews(code);
    return NextResponse.json(news);
  } catch (error) {
    if (error instanceof UnknownCountryError) {
      return NextResponse.json({ error: "Unknown country code." }, { status: 404 });
    }
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured." },
        { status: 503 },
      );
    }
    console.error("Failed to load country news:", error);
    return NextResponse.json({ error: "Failed to load news." }, { status: 500 });
  }
}
