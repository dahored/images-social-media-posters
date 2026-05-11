import type { AspectRatio, Slide, ContentKind, CarouselBrandingOverride } from "./carousel";

export type TemplateScope = "global" | "brand" | "account";

export interface Template {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  kind?: ContentKind;
  slides: Omit<Slide, "previousVersions">[];
  tags: string[];
  scope?: TemplateScope;
  brandId?: string;
  accountId?: string;
  brandingOverride?: CarouselBrandingOverride;
  createdAt: string;
  updatedAt: string;
}

export interface TemplatesData {
  templates: Template[];
}
