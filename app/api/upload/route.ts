import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Tidak ada gambar yang dikirim" }, { status: 400 });
    }

    // Ekstrak data base64 (buang prefix "data:image/jpeg;base64,")
    const parts = imageBase64.split(",");
    const base64Data = parts.length > 1 ? parts[1] : parts[0];

    // Gunakan URLSearchParams karena lebih stabil di Node.js fetch untuk mengirim string panjang
    const params = new URLSearchParams();
    params.append("image", base64Data);

    // Kunci API ImgBB
    const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "e0e12e5239c17a72c88d340b06f2c217";

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return NextResponse.json({ url: data.data.url });
    } else {
      console.error("ImgBB Error Response:", data);
      return NextResponse.json({ error: data.error?.message || "Gagal upload ke ImgBB dari server" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Upload API Error Terjadi:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error di Backend" }, { status: 500 });
  }
}

