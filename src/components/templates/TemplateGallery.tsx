"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { TemplateCard } from "./TemplateCard";
import type { Template, TemplateScope } from "@/types/template";
import { cn } from "@/lib/utils";

const TABS: { key: TemplateScope | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "global", label: "Global" },
  { key: "brand", label: "Brand" },
  { key: "account", label: "Account" },
];

export function TemplateGallery() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TemplateScope | "all">("all");

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  const handleDelete = useCallback(async (templateId: string) => {
    const res = await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    }
  }, []);

  const filtered = activeTab === "all"
    ? templates
    : templates.filter((t) => (t.scope || "global") === activeTab);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Scope tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium border-b-2 transition-colors",
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
            {templates.length === 0 ? "No templates saved yet" : "No templates in this scope"}
          </p>
          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Save a carousel as a template to reuse it later
            </p>
          )}
        </div>
      ) : (
        <div className="oc-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUse}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
