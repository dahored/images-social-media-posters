import { NextResponse } from "next/server";
import { updateSlide, deleteSlide, getCarousel } from "@/lib/carousels";
import { isStructurallyEquivalent } from "@/lib/slot-extractor";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;
  try {
    const body = await request.json();

    // Template-lock guard: when the carousel is locked, an HTML update must
    // preserve the slot schema (same role classes in same order). Only text
    // and color/font values may change.
    if (typeof body.html === "string") {
      const carousel = await getCarousel(id);
      if (carousel?.templateLocked) {
        const oldSlide = carousel.slides.find((s) => s.id === slideId);
        if (oldSlide && !isStructurallyEquivalent(oldSlide.html, body.html)) {
          return NextResponse.json(
            { error: "Template locked — HTML structure (semantic role classes) must be preserved. Modify only text content and color/font values." },
            { status: 422 }
          );
        }
      }
    }

    const slide = await updateSlide(id, slideId, body);
    if (!slide) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(slide);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const { id, slideId } = await params;
  const deleted = await deleteSlide(id, slideId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
