import { NextResponse } from "next/server";
import { listNetworks, createNetwork } from "@/lib/networks";

export async function GET() {
  const networks = await listNetworks();
  return NextResponse.json({ networks });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, icon, defaultStyleHint, formats } = body as {
      name?: string;
      icon?: string;
      defaultStyleHint?: string;
      formats?: unknown[];
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const network = await createNetwork({
      name: name.trim(),
      icon: icon || "Globe",
      defaultStyleHint: defaultStyleHint || "",
      formats: (formats as never) || [],
    });

    return NextResponse.json(network, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
