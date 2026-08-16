import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY belum terpasang." }, { status: 500 });
    }

    const { lokasi, masalah, instansi } = await req.json();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `Anda adalah seorang komika (Stand-up Comedian) sarkas namun cerdas dari Indonesia.
Tugas Anda adalah membuat teks "Roasting" (sindiran lucu, satir, ironi) terhadap pemerintah/dinas terkait karena lambatnya perbaikan fasilitas umum.

Data Laporan Kerusakan:
- Instansi yang bertanggung jawab: ${instansi || "Pemerintah Daerah"}
- Lokasi: ${lokasi}
- Detail Kerusakan: ${masalah}

ATURAN ROASTING:
1. Buat dalam 1 paragraf singkat (maksimal 3-4 kalimat).
2. Gunakan gaya bahasa gaul anak Twitter/TikTok Indonesia (contoh: "Gimana nih", "Bisa-bisanya", "Masa iya").
3. Harus lucu, sarkas, nyelekit, tapi TETAP SOPAN (TIDAK BOLEH mengandung kata kasar, makian, atau SARA).
4. Buat agar teks ini cocok untuk dicopy-paste dan diviralkan oleh warga ke sosial media.
5. Jangan gunakan hashtag, cukup teks murni saja.
6. LANGSUNG jawab dengan teks roasting-nya, tanpa awalan seperti "Tentu, ini dia".`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    
    let roastText = response.text().trim();
    
    // Fallback jika API membandel kasih awalan
    if (roastText.toLowerCase().startsWith("berikut") || roastText.toLowerCase().startsWith("tentu")) {
        const parts = roastText.split("\n");
        if (parts.length > 1) {
            roastText = parts.slice(1).join("\n").trim();
        }
    }

    return NextResponse.json({ result: roastText });

  } catch (error: any) {
    console.error("ERROR ROAST API:", error);
    return NextResponse.json({ error: "Gagal memproses roasting.", details: error.message }, { status: 500 });
  }
}
