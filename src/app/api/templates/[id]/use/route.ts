import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/templates";
import { createCarousel, addSlide, updateCarousel, getCarousel } from "@/lib/carousels";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Accept accountId from body (preferred) or fall back to template.accountId
  let accountId: string | undefined = template.accountId;
  try {
    const body = await request.json() as { accountId?: string };
    if (body?.accountId) accountId = body.accountId;
  } catch {
    // no body — keep template.accountId fallback
  }

  const carousel = await createCarousel(
    `${template.name} (from template)`,
    template.aspectRatio,
    template.kind ?? "carousel",
    undefined,
    accountId,
  );

  for (const slide of template.slides) {
    await addSlide(carousel.id, slide.html, slide.notes);
  }

  // Stamp template lineage and lock structure by default
  await updateCarousel(carousel.id, { templateId: id, templateLocked: true });
  const final = await getCarousel(carousel.id);

  return NextResponse.json(final ?? carousel, { status: 201 });
}
