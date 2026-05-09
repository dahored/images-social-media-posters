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
    // Compute logo config from effective branding
    const accountId = carousel.accountId;
    const branding = accountId ? await getEffectiveBranding(accountId) : null;
    const activeTheme = carousel.brandingOverride?.theme ?? "dark";
    const logoPosition = carousel.brandingOverride?.logoPosition ?? branding?.logoPosition ?? "bottom-center";
    const logoHeight = carousel.brandingOverride?.logoHeight ?? branding?.logoHeight ?? 72;
    const carouselLogoPath = branding
      ? (activeTheme === "dark"
          ? (branding.logoPathLight ?? branding.logoPath ?? null)
          : (branding.logoPathDark ?? branding.logoPath ?? null))
      : null;
    const logoConfig: LogoConfig | undefined = carouselLogoPath
      ? { path: carouselLogoPath, position: logoPosition, height: logoHeight }
      : undefined;

    // Compute per-slide color/font substitution
    const brandDark = branding?.colors;
    const brandLight = branding?.colorsLight;
    const brandBaseForTheme = activeTheme === "dark" ? brandDark : (brandLight ?? brandDark);
    const carouselColorsDark  = carousel.brandingOverride?.colors;
    const carouselColorsLight = carousel.brandingOverride?.colorsLight;
    const carouselColorOverride = activeTheme === "dark" ? carouselColorsDark : carouselColorsLight;
    const overrideFonts = carousel.brandingOverride?.fonts;
    const brandFonts = branding?.fonts;
    const fontSubstitution: FontSubstitution | undefined = brandFonts
      ? {
          heading: { from: brandFonts.heading, to: overrideFonts?.heading ?? brandFonts.heading },
          body:    { from: brandFonts.body,    to: overrideFonts?.body    ?? brandFonts.body    },
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
      // Per-slide theme override wins over carousel theme
      const slideTheme: "dark" | "light" = slide.styleOverride?.theme ?? activeTheme;

      // Per-slide logo: per-theme explicit path > theme-based variant; per-slide position/height override
      const slideLogoOverride = slideTheme === "dark"
        ? slide.styleOverride?.logoPath
        : slide.styleOverride?.logoPathLight;
      const slideLogoPath = slideLogoOverride
        ?? (branding
          ? (slideTheme === "dark"
            ? (branding.logoPathLight ?? branding.logoPath ?? null)
            : (branding.logoPathDark  ?? branding.logoPath ?? null))
          : null);
      const slideLogoPosition = slide.styleOverride?.logoPosition ?? logoPosition;
      const slideLogoHeight   = slide.styleOverride?.logoHeight   ?? logoHeight;
      const slideLogoConfig: LogoConfig | undefined = slideLogoPath
        ? { path: slideLogoPath, position: slideLogoPosition, height: slideLogoHeight }
        : logoConfig;

      // Per-slide font substitution: slide override > carousel override > brand
      const sFonts = slide.styleOverride?.fonts;
      const slideFontSub: FontSubstitution | undefined = brandFonts
        ? {
            heading: { from: brandFonts.heading, to: sFonts?.heading ?? overrideFonts?.heading ?? brandFonts.heading },
            body:    { from: brandFonts.body,    to: sFonts?.body    ?? overrideFonts?.body    ?? brandFonts.body    },
          }
        : fontSubstitution;

      if (!brandDark || !brandBaseForTheme) return { logoConfig: slideLogoConfig, customBackground: slide.styleOverride?.customBackground, fontSubstitution: slideFontSub };

      const slideBase = slideTheme === "dark" ? brandDark : (brandLight ?? brandDark);
      const slideCarouselOverride = slideTheme === "dark" ? carouselColorsDark : carouselColorsLight;
      const slideColorOverride = slideTheme === "dark"
        ? slide.styleOverride?.colors
        : slide.styleOverride?.colorsLight;
      const mergedColors = mergeColors(slideBase, slideCarouselOverride, slideColorOverride);
      const colorSubstitution: ColorSubstitution = {
        from: { ...(brandBaseForTheme ?? brandDark) },
        to: mergedColors,
      };
      return { colorSubstitution, fontSubstitution: slideFontSub, customBackground: slide.styleOverride?.customBackground, logoConfig: slideLogoConfig, accentOverride: mergedColors.accent };
    }

    // Export all slides to PNG buffers
    const pngBuffers = await exportAllSlides(
      carousel.slides,
      carousel.aspectRatio,
      logoConfig,
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
