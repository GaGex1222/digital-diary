import { google } from "googleapis";
import { PassThrough } from "stream";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function getDrive() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauth2 });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mediaType = formData.get("mediaType") as string;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const drive = getDrive();
    const buffer = Buffer.from(await file.arrayBuffer());

    // PassThrough is more reliable than Readable.from in Next.js API routes
    const stream = new PassThrough();
    stream.end(buffer);

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const res = await drive.files.create({
      requestBody: {
        name: file.name,
        ...(folderId ? { parents: [folderId] } : {}),
      },
      media: { mimeType: file.type, body: stream },
      fields: "id",
    });

    const fileId = res.data.id!;

    // Make publicly readable
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const url =
      mediaType === "video"
        ? `https://drive.google.com/file/d/${fileId}/preview`
        : `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

    return NextResponse.json({ fileId, url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Drive Upload Error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
