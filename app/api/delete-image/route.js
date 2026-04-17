import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export async function POST(request) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("[api/delete-image] Missing Cloudinary env vars");
      return NextResponse.json(
        {
          success: false,
          error:
            "Cloudinary server credentials are missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.local and restart the server.",
        },
        { status: 500 }
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const body = await request.json();
    const publicId = body?.publicId?.toString().trim();

    if (!publicId) {
      return NextResponse.json(
        { success: false, error: "publicId is required" },
        { status: 400 }
      );
    }

    console.log("[api/delete-image] deleting:", publicId);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("[api/delete-image] cloudinary result:", result);

    const deleted = result?.result === "ok" || result?.result === "not found";
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Cloudinary deletion failed", result },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    console.error("[api/delete-image] error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
