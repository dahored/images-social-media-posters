#!/usr/bin/env node
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const FILE = path.join(DATA_DIR, "networks.json");

function now() {
  return new Date().toISOString();
}

const NETWORKS = [
  {
    id: "instagram",
    name: "Instagram",
    icon: "Instagram",
    defaultStyleHint: "Bold, visual, mobile-first. Mix lifestyle imagery with text. High contrast, punchy hooks. Warm tones perform well. Reels thumbnails need to grab in 0.5s.",
    builtin: true,
    formats: [
      {
        id: "post",
        name: "Post",
        ratios: [
          { ratio: "1:1", width: 1080, height: 1080, label: "Square" },
          { ratio: "4:5", width: 1080, height: 1350, label: "Portrait (recommended)" },
        ],
      },
      {
        id: "story",
        name: "Story / Reels",
        ratios: [
          { ratio: "9:16", width: 1080, height: 1920, label: "Fullscreen" },
        ],
      },
      {
        id: "carousel",
        name: "Carousel",
        ratios: [
          { ratio: "1:1", width: 1080, height: 1080, label: "Square" },
          { ratio: "4:5", width: 1080, height: 1350, label: "Portrait" },
        ],
      },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "Facebook",
    defaultStyleHint: "Mix of informative and entertaining. Slightly longer captions work. Older demographic than Instagram. Text overlays with data/stats perform well.",
    builtin: true,
    formats: [
      {
        id: "post",
        name: "Post",
        ratios: [
          { ratio: "1.91:1", width: 1200, height: 628, label: "Landscape (link preview)" },
          { ratio: "1:1", width: 1080, height: 1080, label: "Square" },
          { ratio: "4:5", width: 1080, height: 1350, label: "Portrait" },
        ],
      },
      {
        id: "story",
        name: "Story",
        ratios: [
          { ratio: "9:16", width: 1080, height: 1920, label: "Fullscreen" },
        ],
      },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "Music",
    defaultStyleHint: "Fast, punchy, Gen-Z energy. Text must be very large (visible on small screens). Bold contrasting colors. Trending sounds and memes. Hook in the first 2 words.",
    builtin: true,
    formats: [
      {
        id: "video-cover",
        name: "Video Cover",
        ratios: [
          { ratio: "9:16", width: 1080, height: 1920, label: "Fullscreen vertical" },
        ],
      },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "Linkedin",
    defaultStyleHint: "Professional, insightful, data-driven. B2B tone. Lists and frameworks perform well. Clean typography, muted palette. Thought leadership over hype.",
    builtin: true,
    formats: [
      {
        id: "post",
        name: "Post",
        ratios: [
          { ratio: "1:1", width: 1080, height: 1080, label: "Square" },
          { ratio: "1.91:1", width: 1200, height: 628, label: "Landscape" },
          { ratio: "4:5", width: 1080, height: 1350, label: "Portrait" },
        ],
      },
      {
        id: "document",
        name: "Document / Carousel",
        ratios: [
          { ratio: "1:1.41", width: 1080, height: 1527, label: "A4 landscape" },
          { ratio: "1:1", width: 1080, height: 1080, label: "Square" },
        ],
      },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    icon: "Twitter",
    defaultStyleHint: "Short, sharp, opinionated. Hot takes and contrarian views. Meme-adjacent. Very text-heavy is fine. Minimal design, maximum wit.",
    builtin: true,
    formats: [
      {
        id: "post",
        name: "Post",
        ratios: [
          { ratio: "16:9", width: 1600, height: 900, label: "Landscape" },
          { ratio: "1:1", width: 1080, height: 1080, label: "Square" },
        ],
      },
    ],
  },
  {
    id: "pinterest",
    name: "Pinterest",
    icon: "Pin",
    defaultStyleHint: "Aesthetic, aspirational, DIY and how-to content. Tall pins dominate. Text overlays must be readable at thumbnail size. Warm, bright, airy palettes.",
    builtin: true,
    formats: [
      {
        id: "standard-pin",
        name: "Standard Pin",
        ratios: [
          { ratio: "2:3", width: 1000, height: 1500, label: "Standard (recommended)" },
        ],
      },
      {
        id: "long-pin",
        name: "Long Pin",
        ratios: [
          { ratio: "1:2.1", width: 1000, height: 2100, label: "Long" },
        ],
      },
    ],
  },
];

async function run() {
  await mkdir(DATA_DIR, { recursive: true });

  const ts = now();
  const networks = NETWORKS.map((n) => ({ ...n, createdAt: ts, updatedAt: ts }));
  await writeFile(FILE, JSON.stringify({ networks }, null, 2), "utf-8");

  console.log(`✓ Seeded ${networks.length} networks → data/networks.json`);
  networks.forEach((n) => console.log(`  • ${n.name} (${n.formats.length} formats)`));
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
