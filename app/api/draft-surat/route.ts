import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Konfigurasi Gagal: GEMINI_API_KEY belum terpasang." }, 
        { status: 500 }
      );
    }

    const { reportDetails, instansi, lokasi } = await req.json();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Anda adalah asisten administrasi pemerintahan profesional. 
    Buatlah sebuah draf Surat Perintah Kerja (SPK) formal untuk menindaklanjuti laporan warga.
    
    Data Laporan:
    - Instansi Tujuan: ${instansi}
    - Lokasi Kejadian: ${lokasi}
    - Deskripsi Masalah: ${reportDetails}
    
    Format Surat:
    1. Harus menyertakan Kop Surat formal pemerintahan fiktif (Pemerintah Kota LaporAman).
    2. Tanggal hari ini.
    3. Nomor surat bebas (format: SPK/XX/2026).
    4. Perihal: Tindak Lanjut Perbaikan Infrastruktur.
    5. Paragraf pembuka yang menyatakan adanya laporan warga terkait kerusakan di lokasi tersebut.
    6. Instruksi tegas namun sopan kepada tim lapangan/kontraktor untuk segera melakukan peninjauan dan perbaikan.
    7. Penutup resmi.
    8. Ditandatangani oleh Kepala Dinas terkait.
    
    Pastikan menggunakan bahasa Indonesia baku, formal, dan siap cetak.
    ATURAN SANGAT PENTING: Jawab LANGSUNG dengan isi suratnya. DILARANG KERAS menambahkan kata-kata pengantar seperti "Berikut adalah drafnya", "Tentu", dll. DILARANG MENGGUNAKAN MARKDOWN.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    let cleanText = response.text().replace(/\*\*/g, "");
    const rawText = cleanText;
    
    if (cleanText.toLowerCase().startsWith("tentu")) {
        const parts = cleanText.split("---");
        if (parts.length > 1) {
            cleanText = parts.slice(1).join("---").trim();
        } else {
            // Jika tidak ada garis putus-putus, hapus saja baris pertama
            cleanText = cleanText.split("\n").slice(1).join("\n").trim();
        }
    }
    
    // Fallback jika pembersihan malah membuat teks hilang
    if (!cleanText) {
      cleanText = rawText || "AI tidak memberikan respon teks.";
    }
    
    return NextResponse.json({ result: cleanText });
  } catch (error: any) {
    console.error("ERROR AI SURAT:", error);
    return NextResponse.json({ error: "Gagal membuat draf surat.", details: error.message }, { status: 500 });
  }
}
