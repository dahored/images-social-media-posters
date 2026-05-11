import { NextResponse } from "next/server";
import { listTemplates, saveAsTemplate } from "@/lib/templates";
import { getCarousel, updateCarousel } from "@/lib/carousels";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;
  const templates = await listTemplates({ accountId });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { carouselId, name, description } = body as {
      carouselId?: string;
      name?: string;
      description?: string;
    };

    if (!carouselId) {
      return NextResponse.json(
        { error: "carouselId is required" },
        { status: 400 }
      );
    }

    const carousel = await getCarousel(carouselId);
    if (!carousel) {
      return NextResponse.json(
        { error: "Carousel not found" },
        { status: 404 }
      );
    }

    const template = await saveAsTemplate(carousel, name, description);
    // Link the carousel back to its new template so future saves offer the update flow
    await updateCarousel(carouselId, { templateId: template.id });
    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
