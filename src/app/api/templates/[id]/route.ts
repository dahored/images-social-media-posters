import { NextResponse } from "next/server";
import { getTemplate, deleteTemplate, updateTemplateFromCarousel } from "@/lib/templates";
import { getCarousel } from "@/lib/carousels";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(template);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json() as { carouselId?: string };
    if (!body.carouselId) {
      return NextResponse.json({ error: "carouselId required" }, { status: 400 });
    }
    const carousel = await getCarousel(body.carouselId);
    if (!carousel) {
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }
    const updated = await updateTemplateFromCarousel(id, carousel);
    if (!updated) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteTemplate(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
