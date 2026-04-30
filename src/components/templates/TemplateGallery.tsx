"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { TemplateCard } from "./TemplateCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import type { Template, TemplateScope } from "@/types/template";
import { cn } from "@/lib/utils";

export function TemplateGallery() {
  const { t } = useI18n();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TemplateScope | "all">("all");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const TABS: { key: TemplateScope | "all"; label: string }[] = [
    { key: "all", label: t("all") },
    { key: "global", label: t("tabGlobal") },
    { key: "brand", label: t("brands") },
    { key: "account", label: t("accounts") },
  ];

  useEffect(() => {
    const fetchTemplates = () => {
      const accountId = localStorage.getItem("activeAccountId");
      const url = accountId ? `/api/templates?accountId=${accountId}` : "/api/templates";
      setLoading(true);
      fetch(url)
        .then((r) => r.json())
        .then((data) => { setTemplates(data.templates || []); setLoading(false); })
        .catch(() => setLoading(false));
    };
    fetchTemplates();
    const handleAccountChange = () => fetchTemplates();
    window.addEventListener("account-changed", handleAccountChange);
    return () => window.removeEventListener("account-changed", handleAccountChange);
  }, []);

  const handleUse = useCallback(
    async (templateId: string) => {
      const res = await fetch(`/api/templates/${templateId}/use`, { method: "POST" });
      if (res.ok) {
        const carousel = await res.json();
        router.push(`/carousel/${carousel.id}`);
      }
    },
    [router]
  );

  const confirmAndDelete = useCallback((templateId: string, name: string) => {
    setConfirmDelete({ id: templateId, name });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const res = await fetch(`/api/templates/${confirmDelete.id}`, { method: "DELETE" });
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== confirmDelete.id));
    setConfirmDelete(null);
  }, [confirmDelete]);

  const filtered = activeTab === "all"
    ? templates
    : templates.filter((tmpl) => (tmpl.scope || "global") === activeTab);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t("deleteTemplateConfirm", { name: confirmDelete?.name ?? "" })}
        description={t("deleteTemplateDesc")}
        confirmLabel={t("delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />

      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors cursor-pointer",
              activeTab === tab.key
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Bookmark className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {templates.length === 0 ? t("noTemplates") : t("noTemplatesScope")}
          </p>
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">{t("saveToReuse")}</p>
          )}
        </div>
      ) : (
        <div className="oc-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUse}
              onDelete={(id) => confirmAndDelete(id, template.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
