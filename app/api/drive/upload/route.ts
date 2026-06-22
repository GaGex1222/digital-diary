import { google } from "googleapis";
import { PassThrough } from "stream";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function getDrive() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mediaType = formData.get("mediaType") as string;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const drive = getDrive();
    const buffer = Buffer.from(await file.arrayBuffer());

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
