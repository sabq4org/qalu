import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getObject, isStorageConfigured } from "@/services/objectStorage";

export const runtime = "nodejs";

/**
 * بروكسي قراءة لملفات البكت الخاص (Railway Bucket).
 * يسمح فقط بمفتاح تحت figures/ — لا سرد ولا كتابة.
 * إن غاب S3 يحاول public/figures كاحتياطي للتطوير المحلي.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path ?? [];
  const key = segments.map(decodeURIComponent).join("/");
  if (!key || key.includes("..") || !key.startsWith("figures/")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    if (isStorageConfigured()) {
      const obj = await getObject(key);
      const bytes = obj.Body ? Buffer.from(await obj.Body.transformToByteArray()) : null;
      if (!bytes?.length) return new NextResponse("Not Found", { status: 404 });
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": obj.ContentType ?? guessContentType(key),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    // احتياطي محلي: public/figures/...
    const rel = key.replace(/^figures\//, "");
    const filePath = path.join(process.cwd(), "public", "figures", rel);
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": guessContentType(key),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[media]", key, err);
    return new NextResponse("Not Found", { status: 404 });
  }
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
