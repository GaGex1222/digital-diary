import { google } from "googleapis";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";

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
    const stream = Readable.from(buffer);
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

    // Images: thumbnail URL (renders in <img> tags)
    // Videos: preview URL (renders in <iframe>)
    const url =
      mediaType === "video"
        ? `https://drive.google.com/file/d/${fileId}/preview`
        : `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

    return NextResponse.json({ fileId, url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
