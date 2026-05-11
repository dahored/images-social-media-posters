import { NextResponse } from "next/server";
import archiver from "archiver";
import { getCarousel } from "@/lib/carousels";
import { exportAllSlides } from "@/lib/export-slides";
import { getBrand as getLegacyBrand } from "@/lib/brand";
import { getEffectiveBranding } from "@/lib/accounts";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";
import type { Slide } from "@/types/carousel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(_request.url);
  const formatJson = url.searchParams.get("format") === "json";
  const carousel = await getCarousel(id);

  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  if (carousel.slides.length === 0) {
    return NextResponse.json({ error: "No slides to export" }, { status: 400 });
  }

  try {
    const accountId = carousel.accountId;
    const branding = accountId ? await getEffectiveBranding(accountId) : null;
    const safeCarousel = carousel;
    function getSlideOverrides(slide: Slide) {
      if (!branding) return undefined;
      return computeSlideRendererProps(branding, safeCarousel, slide);
    }

    // Export all slides to PNG buffers
    const pngBuffers = await exportAllSlides(
      carousel.slides,
      carousel.aspectRatio,
      undefined,
      getSlideOverrides
    );

    // Build export filename: {brandSlug}_{networkId}_{title}_{ratio}
    const brand = await getLegacyBrand();
    const brandSlug = brand.name
      ? brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : "brand";
    const networkSlug = carousel.networkId || "instagram";
    const titleSlug = carousel.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ratioSlug = carousel.aspectRatio.replace(":", "x");
    const safeName = `${brandSlug}_${networkSlug}_${titleSlug}_${ratioSlug}`;

    // format=json: return PNGs as base64 JSON (for Web Share API / clipboard)
    if (formatJson) {
      const buffers = carousel.kind === "post" ? [pngBuffers[0]] : pngBuffers;
      const files = buffers.map(({ name, buffer }) => ({
        name,
        data: Buffer.from(buffer).toString("base64"),
      }));
      return NextResponse.json({ files });
    }

    // Single-image post: return PNG directly
    if (carousel.kind === "post") {
      const { buffer } = pngBuffers[0];
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="post-${safeName}.png"`,
        },
      });
    }

    // Carousel: build ZIP archive
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 5 } });
      const chunks: Buffer[] = [];

      archive.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      archive.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on("error", (err) => {
        reject(err);
      });

      try {
        for (const { name, buffer } of pngBuffers) {
          archive.append(buffer, { name });
        }
        archive.finalize();
      } catch (err) {
        archive.destroy();
        reject(err);
      }
    });

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="carousel-${safeName}.zip"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Export failed: ${message}` },
      { status: 500 }
    );
  }
}
