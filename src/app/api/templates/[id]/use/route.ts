import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/templates";
import { createCarousel, addSlide, updateCarousel, getCarousel } from "@/lib/carousels";
import { detectSlideRootBackground } from "@/lib/slide-html";
import type { CarouselBrandingOverride } from "@/types/carousel";

function detectThemeFromHtml(html: string | undefined): "dark" | "light" {
  const bg = detectSlideRootBackground(html ?? "");
  if (!bg) return "dark";
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 128 ? "light" : "dark";
}

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

  // Use stored theme if template has it; detect from HTML for older templates that predate the fix
  const brandingOverride: CarouselBrandingOverride = template.brandingOverride ?? {
    theme: detectThemeFromHtml(template.slides[0]?.html),
  };

  const carousel = await createCarousel(
    `${template.name} (from template)`,
    template.aspectRatio,
    template.kind ?? "carousel",
    undefined,
    accountId,
    brandingOverride,
  );

  for (const slide of template.slides) {
    await addSlide(carousel.id, slide.html, slide.notes, slide.styleOverride);
  }

  // Stamp template lineage and lock structure by default
  await updateCarousel(carousel.id, { templateId: id, templateLocked: true });
  const final = await getCarousel(carousel.id);

  return NextResponse.json(final ?? carousel, { status: 201 });
}
