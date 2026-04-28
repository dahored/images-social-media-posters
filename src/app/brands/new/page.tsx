"use client";

import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { BrandWizard } from "@/components/brand/BrandWizard";
import type { Brand } from "@/types/brand";

export default function NewBrandPage() {
  const router = useRouter();

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <BrandWizard onComplete={(_brand: Brand) => router.push("/brands")} />
      </main>
    </div>
  );
}
