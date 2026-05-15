"use client";

import { useRouter, useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { GridGallery } from "@/components/grids/GridGallery";
import { useI18n } from "@/lib/i18n/context";

type TabId = "plantillas" | "grids";

const PATH_TO_TAB: Record<string, TabId> = {
  plantillas: "plantillas",
  grids: "grids",
};

const TAB_TO_PATH: Record<TabId, string> = {
  plantillas: "plantillas",
  grids: "grids",
};

export default function TemplatesPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();

  const activeTab: TabId = PATH_TO_TAB[params.tab as string] ?? "plantillas";

  const navigateTab = (tab: TabId) => router.push(`/templates/${TAB_TO_PATH[tab]}`);

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t("templates")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("gridGalleryHint")}
            </p>
          </div>

          <div className="flex gap-1 mb-6 border-b border-border">
            {(["plantillas", "grids"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => navigateTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "plantillas" ? t("templates") : t("grids")}
              </button>
            ))}
          </div>

          {activeTab === "plantillas" ? <TemplateGallery /> : <GridGallery />}
        </div>
      </main>
    </div>
  );
}
