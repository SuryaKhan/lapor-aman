import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY belum terpasang." }, { status: 500 });
    }

    const { prompt, chatHistory, reportsData } = await req.json();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Format riwayat chat sebelumnya agar AI punya memori percakapan
    const formattedHistory = chatHistory.map((msg: any) => {
      return `[${msg.sender === "admin" ? "Admin" : "AI"}]: ${msg.text}`;
    }).join("\n");

    const systemPrompt = `Anda adalah Asisten Cerdas Khusus Admin (Command Center) dari aplikasi LaporAman.
Tugas Anda adalah menjawab pertanyaan Admin mengenai rekapitulasi data infrastruktur kota berdasarkan data JSON yang dilampirkan.
ATURAN SANGAT KETAT (SISTEM ANTI-OOT): 
1. Anda DILARANG KERAS menjawab pertanyaan apa pun yang TIDAK berhubungan dengan data infrastruktur kota, laporan warga, atau fungsi aplikasi LaporAman.
2. Jika pengguna menanyakan topik di luar itu (contoh: cuaca, resep masakan, politik, sejarah, pemrograman umum, dll), Anda WAJIB MENOLAK secara halus dengan mengatakan: "Maaf, sebagai Asisten Command Center, saya hanya berwenang menjawab pertanyaan seputar data laporan infrastruktur LaporAman."
3. Anda boleh melakukan perhitungan matematika jika diminta merekap data (misal: berapa persen laporan selesai).
4. Jawablah langsung pada intinya tanpa bertele-tele. Jangan gunakan markdown yang berlebihan.

DATA LAPORAN SAAT INI (Bentuk JSON):
${JSON.stringify(reportsData)}

RIWAYAT PERCAKAPAN:
${formattedHistory}

PERTANYAAN TERBARU ADMIN:
${prompt}
`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    return NextResponse.json({ result: response.text() });

  } catch (error: any) {
    console.error("ERROR CHATBOT:", error);
    return NextResponse.json({ error: "Gagal memproses pertanyaan.", details: error.message }, { status: 500 });
  }
}
