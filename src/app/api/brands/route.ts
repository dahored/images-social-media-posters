import { NextResponse } from "next/server";
import { listBrands, createBrand } from "@/lib/brands";

export async function GET() {
  const brands = await listBrands();
  return NextResponse.json({ brands });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, colors, fonts, logoPath, styleKeywords } = body as Record<string, unknown>;

    if (!name || typeof name !== "string" || !(name as string).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const brand = await createBrand({
      name: (name as string).trim(),
      ...(colors ? { colors: colors as never } : {}),
      ...(fonts ? { fonts: fonts as never } : {}),
      ...(logoPath !== undefined ? { logoPath: logoPath as string | null } : {}),
      ...(styleKeywords ? { styleKeywords: styleKeywords as string[] } : {}),
    });

    return NextResponse.json(brand, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
