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
export const maxDuration = 300;

type ExportedFile = { folder: string; fileName: string; buffer: Buffer };

async function exportCarousel(id: string, brandSlug: string): Promise<ExportedFile[]> {
  const carousel = await getCarousel(id);
  if (!carousel || carousel.slides.length === 0) return [];

  const accountId = carousel.accountId;
  const branding = accountId ? await getEffectiveBranding(accountId) : null;
  const safeCarousel = carousel;
  function getSlideOverrides(slide: Slide) {
    if (!branding) return undefined;
    return computeSlideRendererProps(branding, safeCarousel, slide);
  }

  const pngBuffers = await exportAllSlides(carousel.slides, carousel.aspectRatio, undefined, getSlideOverrides);

  const titleSlug = carousel.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const ratioSlug = carousel.aspectRatio.replace(":", "x");
  const folder = `${brandSlug}_${titleSlug}_${ratioSlug}`;

  return pngBuffers.map(({ name, buffer }, i) => {
    const isOnlySlide = pngBuffers.length === 1;
    return {
      folder,
      fileName: isOnlySlide ? `${folder}.png` : `${folder}/${name}`,
      buffer: Buffer.from(buffer),
    };
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const formatJson = url.searchParams.get("format") === "json";
  const body = await request.json().catch(() => ({})) as { ids?: string[] };
  const ids = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No carousel IDs provided" }, { status: 400 });
  }

  try {
    const brand = await getLegacyBrand();
    const brandSlug = brand.name
      ? brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : "brand";

    const allFiles: ExportedFile[] = [];
    for (const id of ids) {
      const files = await exportCarousel(id, brandSlug);
      allFiles.push(...files);
    }

    if (allFiles.length === 0) {
      return NextResponse.json({ error: "No slides exported" }, { status: 400 });
    }

    // format=json: return as base64 for Web Share API
    if (formatJson) {
      const files = allFiles.map(({ fileName, buffer }) => ({
        name: fileName.replace(/^.*\//, "") || fileName,
        data: buffer.toString("base64"),
      }));
      return NextResponse.json({ files });
    }

    // Return single ZIP
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 5 } });
      const chunks: Buffer[] = [];
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      try {
        for (const { fileName, buffer } of allFiles) {
          archive.append(buffer, { name: fileName });
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
        "Content-Disposition": `attachment; filename="${brandSlug}-posts.zip"`,
      },
    });
  } catch (error) {
    console.error("Bulk export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Export failed: ${message}` }, { status: 500 });
  }
}
