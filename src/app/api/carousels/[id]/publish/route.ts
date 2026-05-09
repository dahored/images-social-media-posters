import { NextResponse } from "next/server";
import { getCarousel, updateCarousel } from "@/lib/carousels";
import { exportAllSlides } from "@/lib/export-slides";
import { sendPhoto, sendMediaGroup, buildCaption, isTelegramConfigured, getDefaultChatId } from "@/lib/telegram";
import { getAccount, getEffectiveBranding } from "@/lib/accounts";
import type { PublishHistoryEntry } from "@/types/carousel";
import type { LogoConfig, ColorSubstitution, FontSubstitution } from "@/lib/slide-html";
import type { Slide } from "@/types/carousel";
import type { BrandColors } from "@/types/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const carousel = await getCarousel(id);

  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  if (carousel.slides.length === 0) {
    return NextResponse.json({ error: "No slides to publish" }, { status: 400 });
  }

  let body: { destination: string; chatId?: string; accountId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { destination, chatId: bodyChatId, accountId: bodyAccountId } = body;
  const accountId = bodyAccountId ?? carousel.accountId;

  const ts = new Date().toISOString();

  if (destination === "telegram") {
    const configured = await isTelegramConfigured();
    if (!configured) {
      return NextResponse.json({ error: "Telegram not configured" }, { status: 400 });
    }

    // Resolve chat ID: body > account > default
    let chatId = bodyChatId;
    if (!chatId && accountId) {
      const account = await getAccount(accountId);
      chatId = account?.telegramChatId;
    }
    if (!chatId) {
      chatId = await getDefaultChatId() ?? undefined;
    }
    if (!chatId) {
      return NextResponse.json({ error: "No chat ID configured" }, { status: 400 });
    }

    try {
      // Compute logo config
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

      const brandDark = branding?.colors;
      const brandLight = branding?.colorsLight;
      const activeThemePub = carousel.brandingOverride?.theme ?? "dark";
      const brandBaseForTheme = activeThemePub === "dark" ? brandDark : (brandLight ?? brandDark);
      const carouselColorsDark  = carousel.brandingOverride?.colors;
      const carouselColorsLight = carousel.brandingOverride?.colorsLight;
      const carouselColorOverride = activeThemePub === "dark" ? carouselColorsDark : carouselColorsLight;
      const overrideFonts = carousel.brandingOverride?.fonts;
      const brandFonts = branding?.fonts;
      const fontSubstitutionPub: FontSubstitution | undefined = brandFonts
        ? {
            heading: { from: brandFonts.heading, to: overrideFonts?.heading ?? brandFonts.heading },
            body:    { from: brandFonts.body,    to: overrideFonts?.body    ?? brandFonts.body    },
          }
        : undefined;

      function mergeColorsPub(
        base: BrandColors,
        carouselOv?: Partial<BrandColors>,
        slideOv?: Partial<BrandColors>
      ): Record<string, string> {
        return {
          primary:    slideOv?.primary    ?? carouselOv?.primary    ?? base.primary,
          secondary:  slideOv?.secondary  ?? carouselOv?.secondary  ?? base.secondary,
          accent:     slideOv?.accent     ?? carouselOv?.accent     ?? base.accent,
          background: slideOv?.background ?? carouselOv?.background ?? base.background,
          surface:    slideOv?.surface    ?? carouselOv?.surface    ?? base.surface,
        };
      }

      function getSlideOverridesPub(slide: Slide) {
        const slideTheme: "dark" | "light" = slide.styleOverride?.theme ?? activeThemePub;

        // Per-slide logo: per-theme explicit path > theme-based variant; per-slide position/height override
        const slideLogoOverridePub = slideTheme === "dark"
          ? slide.styleOverride?.logoPath
          : slide.styleOverride?.logoPathLight;
        const slideLogoPath = slideLogoOverridePub
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
        const sFontsPub = slide.styleOverride?.fonts;
        const slideFontSubPub: FontSubstitution | undefined = brandFonts
          ? {
              heading: { from: brandFonts.heading, to: sFontsPub?.heading ?? overrideFonts?.heading ?? brandFonts.heading },
              body:    { from: brandFonts.body,    to: sFontsPub?.body    ?? overrideFonts?.body    ?? brandFonts.body    },
            }
          : fontSubstitutionPub;

        if (!brandDark || !brandBaseForTheme) return { logoConfig: slideLogoConfig, customBackground: slide.styleOverride?.customBackground, fontSubstitution: slideFontSubPub };

        const slideBase = slideTheme === "dark" ? brandDark : (brandLight ?? brandDark);
        const slideCarouselOv = slideTheme === "dark" ? carouselColorsDark : carouselColorsLight;
        const slideColorOv = slideTheme === "dark"
          ? slide.styleOverride?.colors
          : slide.styleOverride?.colorsLight;
        const mergedColors = mergeColorsPub(slideBase, slideCarouselOv, slideColorOv);
        const colorSubstitution: ColorSubstitution = {
          from: { ...slideBase },
          to: mergedColors,
        };
        return { colorSubstitution, fontSubstitution: slideFontSubPub, customBackground: slide.styleOverride?.customBackground, logoConfig: slideLogoConfig, accentOverride: mergedColors.accent };
      }

      const pngBuffers = await exportAllSlides(
        carousel.slides,
        carousel.aspectRatio,
        logoConfig,
        getSlideOverridesPub
      );
      const buffers = pngBuffers.map((p) => p.buffer);
      const caption = buildCaption(carousel.caption, carousel.hashtags);

      let result: { ok: boolean; error?: string };
      if (carousel.kind === "post" || buffers.length === 1) {
        result = await sendPhoto(chatId, buffers[0], caption);
      } else {
        result = await sendMediaGroup(chatId, buffers, caption);
      }

      const publishRecord: PublishHistoryEntry = {
        destination: "telegram",
        timestamp: ts,
        success: result.ok,
        error: result.error,
      };

      // Store in publish history (appended to carousel)
      const history = [...(carousel.publishHistory || []), publishRecord].slice(-20);
      await updateCarousel(id, { publishHistory: history } as never);

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ ok: true, publishRecord });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown destination" }, { status: 400 });
}
