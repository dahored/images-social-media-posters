import type { AspectRatio, Slide } from "./carousel";

export type TemplateScope = "global" | "brand" | "account";

export interface Template {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  slides: Omit<Slide, "previousVersions">[];
  tags: string[];
  scope?: TemplateScope;
  brandId?: string;
  accountId?: string;
  createdAt: string;
}

export interface TemplatesData {
  templates: Template[];
}
