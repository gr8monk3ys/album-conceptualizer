import { progressionPreviewHandler } from "@/server/progression-preview";

export const runtime = "nodejs";

export const POST = progressionPreviewHandler("midi");
