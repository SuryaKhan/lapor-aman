import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY belum terpasang." }, { status: 500 });
    }

    const { prompt, chatHistory } = await req.json();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Ambil data laporan dari Firestore agar LaporBot tahu status tiket menggunakan REST API (menghindari error gRPC di Node.js)
    let reportsContext = "";
    try {
      const firestoreRes = await fetch("https://firestore.googleapis.com/v1/projects/laporaman-81675/databases/(default)/documents/laporan");
      const firestoreData = await firestoreRes.json();
      
      if (firestoreData.documents) {
        const reports = firestoreData.documents
          .filter((doc: any) => (doc.fields?.status?.stringValue || "") !== "Selesai")
          .map((doc: any) => {
            const fields = doc.fields || {};
            const ticketId = fields.ticketId?.stringValue || "Unknown";
            const lokasi = fields.lokasi?.stringValue || "-";
            const status = fields.status?.stringValue || "-";
            const masalah = fields.masalah?.stringValue || "-";
            return `Tiket: ${ticketId}, Lokasi: ${lokasi}, Status: ${status}, Masalah: ${masalah}`;
          });
        reportsContext = reports.join("\n");
      }
    } catch (e) {
      console.error("Gagal ambil data REST untuk bot", e);
    }

    // Format riwayat chat
    const formattedHistory = chatHistory.map((msg: any) => {
      return `[${msg.sender === "user" ? "Warga" : "AI"}]: ${msg.text}`;
    }).join("\n");

    const systemPrompt = `Anda adalah LaporBot, Asisten Ramah untuk aplikasi publik "LaporAman AI" (Command Center berbasis AI untuk perbaikan fasilitas publik kota).
Tugas Anda adalah membantu warga (masyarakat umum) menjawab pertanyaan mengenai cara melapor jalan rusak, fasilitas publik, atau penggunaan aplikasi ini.

ATURAN SANGAT KETAT (SISTEM ANTI-OOT): 
1. Anda DILARANG KERAS menjawab pertanyaan apa pun yang TIDAK berhubungan dengan pelaporan fasilitas umum, jalan rusak, atau fungsi aplikasi LaporAman.
2. Jika pengguna menanyakan topik di luar itu, tolak dengan sopan.
3. Jawablah dengan ramah, santai tapi sopan (gunakan kata "Kak", "Sobat", dsb).
4. Jika warga menanyakan status sebuah tiket (misal: "LPR-XYZ"), CARI kode tiket tersebut di DATA LAPORAN AKTIF. Beritahu mereka statusnya (Menunggu/Diproses) dan deskripsi singkatnya.
5. Jika kode tiket tidak ada di DATA LAPORAN AKTIF, beritahu bahwa tiket tersebut mungkin salah ketik, ATAU sudah berstatus SELESAI (diarsipkan). Arahkan mereka untuk menggunakan fitur "Lacak Laporan" di Beranda untuk memastikan.

DATA LAPORAN AKTIF (Hanya yang Menunggu/Diproses):
${reportsContext}

RIWAYAT PERCAKAPAN:
${formattedHistory}

PERTANYAAN TERBARU WARGA:
${prompt}
`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    return NextResponse.json({ result: response.text() });

  } catch (error: any) {
    console.error("ERROR PUBLIC CHATBOT:", error);
    return NextResponse.json({ error: "Gagal memproses pertanyaan.", details: error.message }, { status: 500 });
  }
}
