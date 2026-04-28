import { NextResponse } from "next/server";
import archiver from "archiver";
import { getCarousel } from "@/lib/carousels";
import { exportAllSlides } from "@/lib/export-slides";
import { getBrand as getLegacyBrand } from "@/lib/brand";
import { getEffectiveBranding } from "@/lib/accounts";
import type { LogoConfig, ColorSubstitution, FontSubstitution } from "@/lib/slide-html";
import type { Slide } from "@/types/carousel";
import type { BrandColors } from "@/types/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const carousel = await getCarousel(id);

  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  if (carousel.slides.length === 0) {
    return NextResponse.json({ error: "No slides to export" }, { status: 400 });
  }

  try {
    // Compute logo config from effective branding
    const accountId = carousel.accountId;
    const branding = accountId ? await getEffectiveBranding(accountId) : null;
    const activeTheme = carousel.brandingOverride?.theme ?? "dark";
    const logoPath = branding
      ? (activeTheme === "dark"
          ? (branding.logoPathLight ?? branding.logoPath ?? null)
          : (branding.logoPathDark ?? branding.logoPath ?? null))
      : null;
    const logoConfig: LogoConfig | undefined = logoPath
      ? {
          path: logoPath,
          position: carousel.brandingOverride?.logoPosition ?? branding?.logoPosition ?? "bottom-center",
          height: carousel.brandingOverride?.logoHeight ?? branding?.logoHeight ?? 72,
        }
      : undefined;

    // Compute per-slide color/font substitution
    const brandDark = branding?.colors;
    const brandLight = branding?.colorsLight;
    const brandBaseForTheme = activeTheme === "dark" ? brandDark : (brandLight ?? brandDark);
    const carouselColorOverride = activeTheme === "dark"
      ? carousel.brandingOverride?.colors
      : carousel.brandingOverride?.colorsLight;
    const overrideFonts = carousel.brandingOverride?.fonts;
    const brandFonts = branding?.fonts;
    const fontSubstitution: FontSubstitution | undefined = brandFonts
      ? {
          heading: overrideFonts?.heading ? { from: brandFonts.heading, to: overrideFonts.heading } : undefined,
          body: overrideFonts?.body ? { from: brandFonts.body, to: overrideFonts.body } : undefined,
        }
      : undefined;

    function mergeColors(
      base: BrandColors,
      carouselOverride?: Partial<BrandColors>,
      slideOverride?: Partial<BrandColors>
    ): Record<string, string> {
      return {
        primary:    slideOverride?.primary    ?? carouselOverride?.primary    ?? base.primary,
        secondary:  slideOverride?.secondary  ?? carouselOverride?.secondary  ?? base.secondary,
        accent:     slideOverride?.accent     ?? carouselOverride?.accent     ?? base.accent,
        background: slideOverride?.background ?? carouselOverride?.background ?? base.background,
        surface:    slideOverride?.surface    ?? carouselOverride?.surface    ?? base.surface,
      };
    }

    function getSlideOverrides(slide: Slide) {
      if (!brandDark || !brandBaseForTheme) return undefined;
      const slideColorOverride = activeTheme === "dark"
        ? slide.styleOverride?.colors
        : slide.styleOverride?.colorsLight;
      const colorSubstitution: ColorSubstitution = {
        from: { ...brandDark },
        to: mergeColors(brandBaseForTheme, carouselColorOverride, slideColorOverride),
      };
      return { colorSubstitution, fontSubstitution };
    }

    // Export all slides to PNG buffers
    const pngBuffers = await exportAllSlides(
      carousel.slides,
      carousel.aspectRatio,
      logoConfig,
      branding ? getSlideOverrides : undefined
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
