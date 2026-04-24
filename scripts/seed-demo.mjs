#!/usr/bin/env node
/**
 * Creates demo brand + accounts + sample content.
 * Safe to run multiple times — skips if demo content already exists.
 */
const BASE = "http://localhost:3000";

async function api(path, method = "GET", body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function checkServer() {
  try {
    await fetch(`${BASE}/api/carousels`);
    return true;
  } catch {
    return false;
  }
}

const HOOK_SLIDE = `<style>
  .slide{width:1080px;height:1350px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;padding:80px;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);box-sizing:border-box;}
  h1{font-family:'Syne',sans-serif;font-size:80px;font-weight:800;color:#fff;
    line-height:1.1;text-align:center;margin:0;}
  .sub{font-family:'Inter',sans-serif;font-size:26px;color:rgba(255,255,255,0.8);
    margin-top:28px;text-align:center;}
  .swipe{font-family:'Inter',sans-serif;font-size:20px;color:rgba(255,255,255,0.5);
    margin-top:48px;letter-spacing:0.12em;}
</style>
<div class="slide">
  <h1>5 things every founder gets wrong</h1>
  <p class="sub">A brutally honest breakdown</p>
  <p class="swipe">swipe →</p>
</div>`;

const VALUE_SLIDE = `<style>
  .slide{width:1080px;height:1350px;display:flex;flex-direction:column;
    align-items:flex-start;justify-content:center;padding:96px;
    background:#0f0f23;box-sizing:border-box;}
  .num{font-family:'Syne',sans-serif;font-size:120px;font-weight:800;
    color:#6366f1;line-height:1;margin:0;}
  h2{font-family:'Syne',sans-serif;font-size:52px;font-weight:700;color:#fff;
    line-height:1.15;margin:16px 0 0;}
  p{font-family:'Inter',sans-serif;font-size:26px;color:rgba(255,255,255,0.6);
    line-height:1.5;margin:20px 0 0;}
</style>
<div class="slide">
  <span class="num">01</span>
  <h2>Shipping features nobody asked for</h2>
  <p>Talk to users first. Build second. The order matters more than the code.</p>
</div>`;

const POST_SLIDE = `<style>
  .slide{width:1080px;height:1350px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;padding:80px;
    background:linear-gradient(160deg,#f59e0b,#ef4444);box-sizing:border-box;}
  h1{font-family:'Syne',sans-serif;font-size:72px;font-weight:800;color:#fff;
    line-height:1.1;text-align:center;margin:0;}
  p{font-family:'Inter',sans-serif;font-size:28px;color:rgba(255,255,255,0.85);
    text-align:center;margin-top:32px;line-height:1.4;}
  .tag{font-family:'Inter',sans-serif;font-size:18px;color:rgba(255,255,255,0.6);
    margin-top:48px;text-transform:uppercase;letter-spacing:0.1em;}
</style>
<div class="slide">
  <h1>New feature drop</h1>
  <p>Publish directly to Telegram in one click. No more manual exports.</p>
  <p class="tag">MyAppCube Demo · Instagram</p>
</div>`;

async function run() {
  console.log("Checking server...");
  const up = await checkServer();
  if (!up) {
    console.error("Server not running at localhost:3000. Start it with /start or npm run dev.");
    process.exit(1);
  }

  // Check if demo already seeded
  const existing = await api("/api/carousels");
  if (existing.carousels?.some((c) => c.name.includes("Demo — 5 mistakes"))) {
    console.log("✓ Demo already seeded. Skipping.");
    return;
  }

  console.log("Seeding demo content...");

  // 1. Create demo carousel (Instagram 4:5)
  const carousel = await api("/api/carousels", "POST", {
    name: "Demo — 5 mistakes founders make",
    aspectRatio: "4:5",
    kind: "carousel",
    networkId: "instagram",
  });
  console.log(`  ✓ Carousel created: ${carousel.id}`);

  // 2. Add slides
  await api(`/api/carousels/${carousel.id}/slides`, "POST", { html: HOOK_SLIDE, notes: "Hook slide" });
  await api(`/api/carousels/${carousel.id}/slides`, "POST", { html: VALUE_SLIDE, notes: "Value slide 1" });
  console.log("  ✓ Carousel slides added");

  // 3. Create demo post (Instagram 4:5)
  const post = await api("/api/carousels", "POST", {
    name: "Demo — Feature launch post",
    aspectRatio: "4:5",
    kind: "post",
    networkId: "instagram",
  });
  await api(`/api/carousels/${post.id}/slides`, "POST", { html: POST_SLIDE, notes: "Launch post" });
  console.log(`  ✓ Post created: ${post.id}`);

  console.log("\n✓ Demo seeded! Open http://localhost:3000 to explore.");
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
