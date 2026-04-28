"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { BrandWizard } from "@/components/brand/BrandWizard";
import type { Brand } from "@/types/brand";

interface PageProps { params: Promise<{ brandId: string }> }

export default function EditBrandPage({ params }: PageProps) {
  const { brandId } = use(params);
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);

  useEffect(() => {
    fetch(`/api/brands/${brandId}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setBrand(d); else router.push("/brands"); })
      .catch(() => router.push("/brands"));
  }, [brandId, router]);

  if (!brand) {
    return (
      <div className="h-full flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <BrandWizard
          brandId={brandId}
          initialBrand={brand}
          onComplete={() => router.push("/brands")}
        />
      </main>
    </div>
  );
}
