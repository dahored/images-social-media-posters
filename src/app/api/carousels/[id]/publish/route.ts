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

  const { destination, chatId: bodyChatId, accountId } = body;

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

      const brandDark = branding?.colors;
      const brandLight = branding?.colorsLight;
      const activeThemePub = carousel.brandingOverride?.theme ?? "dark";
      const brandBaseForTheme = activeThemePub === "dark" ? brandDark : (brandLight ?? brandDark);
      const carouselColorOverride = activeThemePub === "dark"
        ? carousel.brandingOverride?.colors
        : carousel.brandingOverride?.colorsLight;
      const overrideFonts = carousel.brandingOverride?.fonts;
      const brandFonts = branding?.fonts;
      const fontSubstitutionPub: FontSubstitution | undefined = brandFonts
        ? {
            heading: overrideFonts?.heading ? { from: brandFonts.heading, to: overrideFonts.heading } : undefined,
            body: overrideFonts?.body ? { from: brandFonts.body, to: overrideFonts.body } : undefined,
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
        if (!brandDark || !brandBaseForTheme) return undefined;
        const slideColorOv = activeThemePub === "dark"
          ? slide.styleOverride?.colors
          : slide.styleOverride?.colorsLight;
        const colorSubstitution: ColorSubstitution = {
          from: { ...brandDark },
          to: mergeColorsPub(brandBaseForTheme, carouselColorOverride, slideColorOv),
        };
        return { colorSubstitution, fontSubstitution: fontSubstitutionPub };
      }

      const pngBuffers = await exportAllSlides(
        carousel.slides,
        carousel.aspectRatio,
        logoConfig,
        branding ? getSlideOverridesPub : undefined
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
