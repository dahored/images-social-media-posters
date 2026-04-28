import { NextResponse } from "next/server";
import { listCarousels, createCarousel } from "@/lib/carousels";
import type { AspectRatio, ContentKind, CarouselBrandingOverride } from "@/types/carousel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const carousels = await listCarousels(accountId);
  return NextResponse.json({ carousels });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, aspectRatio, kind, networkId, accountId, brandingOverride } = body as {
      name?: string;
      aspectRatio?: AspectRatio;
      kind?: ContentKind;
      networkId?: string;
      accountId?: string;
      brandingOverride?: CarouselBrandingOverride;
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const validRatios: AspectRatio[] = ["1:1", "4:5", "9:16"];
    const ratio = validRatios.includes(aspectRatio as AspectRatio)
      ? (aspectRatio as AspectRatio)
      : "4:5";

    const contentKind: ContentKind = kind === "post" ? "post" : "carousel";
    const carousel = await createCarousel(name.trim(), ratio, contentKind, networkId, accountId, brandingOverride);
    return NextResponse.json(carousel, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
