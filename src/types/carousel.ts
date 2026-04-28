export type AspectRatio = "1:1" | "4:5" | "9:16";
export type ContentKind = "post" | "carousel";

import type { LogoPosition } from "./brand";

export interface CarouselBrandingOverride {
  theme?: "dark" | "light";
  logoPosition?: LogoPosition;
  logoHeight?: number;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
  };
  colorsLight?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
}

export interface PublishHistoryEntry {
  destination: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

export type SlideColorSet = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
};

export interface Slide {
  id: string;
  html: string;
  previousVersions: string[];
  order: number;
  notes: string;
  styleOverride?: {
    colors?: SlideColorSet;
    colorsLight?: SlideColorSet;
    fonts?: { heading?: string; body?: string };
  };
}

export interface ReferenceImage {
  id: string;
  url: string;       // e.g. "/uploads/abc.png"
  absPath: string;    // absolute path for Claude to Read
  name: string;       // original filename or description
  addedAt: string;
}

export interface Carousel {
  id: string;
  name: string;
  kind: ContentKind;
  accountId?: string;
  networkId?: string;
  aspectRatio: AspectRatio;
  slides: Slide[];
  referenceImages: ReferenceImage[];
  caption?: string;
  hashtags?: string[];
  publishHistory?: PublishHistoryEntry[];
  brandingOverride?: CarouselBrandingOverride;
  chatSessionId: string | null;
  isTemplate: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CarouselsData {
  carousels: Carousel[];
}

export const DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

export const MAX_SLIDES = 20;
export const MAX_VERSIONS = 5;
