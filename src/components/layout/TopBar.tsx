"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Settings, Layers, Building2, Globe, Send, CalendarDays, LayoutDashboard, BotMessageSquare, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSelector } from "@/components/brand/AccountSelector";
import { useI18n, type Locale } from "@/lib/i18n/context";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  backHref?: string;
  editable?: boolean;
  onTitleChange?: (newTitle: string) => void;
}

function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options: { value: Locale; label: string }[] = [
    { value: "en", label: t("english") },
    { value: "es", label: t("spanish") },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted-foreground gap-1.5 px-2"
        title={t("language")}
      >
        <Globe className="h-3.5 w-3.5" />
        {locale.toUpperCase()}
      </Button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-32 rounded-xl border border-border bg-surface shadow-xl z-50 overflow-hidden py-1">
          {options.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setLocale(value); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                locale === value
                  ? "text-accent font-medium bg-accent/5"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items = [
    { href: "/brands", icon: Building2, label: t("brands") },
    { href: "/settings/networks", icon: Globe, label: t("networks") },
    { href: "/settings/telegram", icon: Send, label: t("telegram") },
    { href: "/settings/claude", icon: BotMessageSquare, label: "Claude" },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("settings")}
      >
        <Settings className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 rounded-xl border border-border bg-surface shadow-xl z-50 overflow-hidden py-1">
          {items.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MainNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const isCalendar = pathname?.startsWith("/calendar");
  const isTemplates = pathname?.startsWith("/templates");
  const navItems = [
    { href: "/content/my-content", label: t("postsNav"), icon: LayoutDashboard, active: !isCalendar && !isTemplates },
    { href: "/templates/plantillas", label: t("templates"), icon: LayoutTemplate, active: isTemplates },
    { href: "/calendar", label: t("calendarNav"), icon: CalendarDays, active: isCalendar },
  ];
  return (
    <nav className="flex items-center gap-0.5">
      {navItems.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            active
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function TopBar({
  title,
  showBack,
  backHref = "/",
  editable,
  onTitleChange,
}: TopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const startEditing = () => {
    setEditValue(title || "");
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange?.(trimmed);
    } else {
      setEditValue(title || "");
    }
    setIsEditing(false);
  };

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-4 gap-3 shrink-0">
      {showBack && (
        <Link href={backHref}>
          <Button variant="ghost" size="icon" aria-label={t("backToDashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      )}
      <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
        <Layers className="h-5 w-5 text-accent" />
      </Link>
      <div className="flex items-center gap-2 min-w-0">
        {isEditing && editable ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditValue(title || "");
                setIsEditing(false);
              }
            }}
            className="font-semibold text-sm bg-transparent border-b-2 border-accent outline-none py-0.5 min-w-30"
          />
        ) : (
          title ? (
            <span
              className={`font-semibold text-sm truncate ${editable ? "cursor-pointer hover:text-accent transition-colors" : ""}`}
              onClick={() => editable && startEditing()}
              title={editable ? t("clickToRename") : undefined}
            >
              {title}
            </span>
          ) : (
            <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
              <span
                className={`font-semibold text-sm truncate`}
              >
                {t("contentStudio")}
              </span>
            </Link>
          )
        )}
      </div>
      {!title && <MainNav />}
      <div className="flex-1" />
      <AccountSelector />
      <LanguageToggle />
      <SettingsDropdown />
    </header>
  );
}
