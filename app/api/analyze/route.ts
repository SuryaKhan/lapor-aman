import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// In-memory rate limiting (Cocok untuk Vibe Coding / MVP)
// Untuk produksi skala besar, sebaiknya gunakan Redis (Upstash) atau Firebase Admin SDK.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const MAX_REQUESTS_PER_HOUR = 5;

export async function POST(req: Request) {
  try {
    // 1. Ambil API Key dari environment variable secara aman di sisi server
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Konfigurasi Gagal: GEMINI_API_KEY belum terpasang di file .env server." }, 
        { status: 500 }
      );
    }

    // --- FITUR: IP RATE LIMITING (ANTI-SPAM SERVER SIDE) ---
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown_ip";
    
    if (ip !== "unknown_ip") {
      const now = Date.now();
      const userLimit = rateLimitMap.get(ip);
      
      if (userLimit) {
        // Reset limit setiap 1 jam
        if (now - userLimit.lastReset > 60 * 60 * 1000) {
          rateLimitMap.set(ip, { count: 1, lastReset: now });
        } else {
          if (userLimit.count >= MAX_REQUESTS_PER_HOUR) {
            return NextResponse.json(
              { error: "Sistem Anti-Spam: Terlalu banyak laporan dari perangkat Anda. Silakan coba lagi dalam 1 jam." },
              { status: 429 }
            );
          }
          userLimit.count += 1;
        }
      } else {
        rateLimitMap.set(ip, { count: 1, lastReset: now });
      }
    }

    const { imageBase64 } = await req.json();
    
    // Potong Base64 dengan aman
    const base64Data = imageBase64.substring(imageBase64.indexOf(',') + 1);
    const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));

    // Inisialisasi Google Gen AI menggunakan kunci dari env
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Prompt instruksi untuk AI (Dengan Sistem Anti-Fake)
    const prompt = `Sebagai AI Analis Infrastruktur Kota, tugas Anda sangat ketat. 
    Langkah 1: Periksa apakah foto ini benar-benar menampilkan jalanan, fasilitas umum, gedung, tiang listrik, atau infrastruktur publik lainnya yang terkait pelaporan masyarakat.
    Jika foto tersebut BUKAN infrastruktur/fasilitas (contoh: foto selfie wajah orang, meme lucu, hewan peliharaan, layar monitor, ruangan gelap gulita, atau pemandangan alam murni tanpa jalan/bangunan), Anda WAJIB langsung membalas HANYA dengan 1 kata: PALSU. Jangan tambah kalimat apapun.
    
    Langkah 2: Jika foto tersebut valid (memang jalan/fasilitas baik rusak maupun tidak), berikan analisis terstruktur dengan format berikut:
    1. 🛠️ Jenis Kerusakan: (Contoh: Jalan berlubang, lampu mati, tidak ada kerusakan, dll)
    2. ⚠️ Tingkat Bahaya: (Pilih salah satu: Rendah / Sedang / Tinggi). 
       - Pilih "Tinggi" HANYA JIKA mengancam nyawa/lumpuh total (misal: jembatan putus, tiang rubuh di jalan raya, tanah longsor).
       - Pilih "Sedang" untuk kerusakan yang mengganggu tapi masih bisa dihindari (misal: jalan berlubang biasa, lampu jalan mati, genangan air).
       - Pilih "Rendah" untuk kerusakan minor/kosmetik (misal: coretan/vandalisme, trotoar retak sedikit, rumput liar).
    3. 📝 Deskripsi Singkat: (Jelaskan apa yang kamu lihat di gambar secara singkat)
    4. 💡 Rekomendasi: (Saran penanganan untuk dinas terkait)
    5. 🏢 Instansi Terkait: (Pilih salah satu yang paling relevan: Dinas PUPR / PLN / Dishub / PDAM / DLH / Lainnya)`;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    return NextResponse.json({ result: response.text() });
    
  } catch (error: any) {
    console.error("ERROR AI:", error);
    return NextResponse.json({ error: "Sistem gagal memproses gambar.", details: error.message }, { status: 500 });
  }
}