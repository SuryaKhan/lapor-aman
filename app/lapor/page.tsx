"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

// Fungsi Hash Image
async function hashImage(base64: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(base64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function LaporPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [imageHashStr, setImageHashStr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingText, setLoadingText] = useState("🚀 Kirim Laporan Resmi ke Server Cloud");
  
  const [lokasi, setLokasi] = useState("");
  const [namaPelapor, setNamaPelapor] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Custom Alert State
  const [customAlert, setCustomAlert] = useState<{isOpen: boolean, title: string, message: string, type: 'error'|'warning'}>({ 
    isOpen: false, title: 'Perhatian', message: '', type: 'error' 
  });

  const showAlert = (message: string, type: 'error'|'warning' = 'error', title = 'Sistem Keamanan') => {
    setCustomAlert({ isOpen: true, title, message, type });
  };

  const ambilLokasiGPS = () => {
    if ("geolocation" in navigator) {
      setLokasi("Mendeteksi lokasi GPS kamu... ⏳"); 
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLokasi(`Titik Koordinat: ${lat}, ${lng}`);
        },
        (error) => {
          console.error("Error GPS:", error);
          showAlert("Gagal ambil lokasi! Pastikan kamu klik 'Allow' / 'Izinkan' saat browser meminta akses GPS.");
          setLokasi("");
        }
      );
    } else {
      showAlert("Browser atau HP kamu tidak mendukung fitur GPS.");
    }
  };

  // FUNGSI KOMPRESI GAMBAR OTOMATIS
  // Sangat penting agar warga/orang tua tidak perlu repot mengecilkan foto manual.
  // Ini mengubah foto 10MB menjadi ~200KB secara instan di HP mereka.
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          // Proporsi rasio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Ubah ke JPEG dan kompres dengan kualitas 70%
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.item(0);
    if (file) {
      // Tampilkan preview instan
      setImagePreview(URL.createObjectURL(file));
      
      try {
        // Kompres otomatis sebelum disimpan di State!
        const compressedBase64 = await compressImage(file);
        setBase64Image(compressedBase64);
        console.log("Foto berhasil dikompres otomatis oleh sistem!");
      } catch (error) {
        console.error("Gagal kompres gambar:", error);
        showAlert("Maaf, gagal memproses foto. Silakan coba foto lain.");
      }
    }
  };

  const analyzeImage = async () => {
    if (!base64Image) return;

    // --- FITUR: ANTI-SPAM (COOLDOWN 60 DETIK) ---
    const lastReportTime = localStorage.getItem("laporaman_last_report");
    if (lastReportTime) {
      const now = new Date().getTime();
      const diffSeconds = (now - parseInt(lastReportTime)) / 1000;
      if (diffSeconds < 60) {
        showAlert(`Sistem Anti-Spam: Anda harus menunggu ${Math.ceil(60 - diffSeconds)} detik lagi untuk membuat laporan baru demi mencegah spam.`);
        return;
      }
    }

    setLoading(true);
    setAnalysisResult(null);
    setIsSubmitted(false);

    try {
      // --- FITUR BARU: ANTI-DUPLIKAT GAMBAR (HASHING) ---
      setLoadingText("Memeriksa duplikasi laporan...");
      const hash = await hashImage(base64Image);
      setImageHashStr(hash);

      const q = query(collection(db, "laporan"), where("imageHash", "==", hash));
      const duplicateSnap = await getDocs(q);
      
      if (!duplicateSnap.empty) {
        showAlert("Sistem Keamanan: Foto persis ini sudah pernah dilaporkan sebelumnya! Laporan ditolak (Anti-Duplikat).");
        setLoading(false);
        setLoadingText("🚀 Kirim Laporan Resmi ke Server Cloud");
        return;
      }
      
      setLoadingText("AI sedang menganalisis gambar...");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image }),
      });
      const data = await res.json();
      
      if (!data.result) {
        if (data.details && data.details.includes("429")) {
          showAlert("Server AI sedang sibuk (Limit). Mohon tunggu sekitar 10-15 detik lalu klik tombol analisis lagi.", "warning");
        } else {
          showAlert(data.error || "Gagal memproses gambar dari server AI.", "error");
        }
        setLoading(false);
        return;
      }
      
      const teksBersih = data.result.replace(/\*\*/g, "");
      
      // --- FITUR: ANTI-FAKE (DETEKSI FOTO PALSU) ---
      if (teksBersih.trim().toUpperCase() === "PALSU" || teksBersih.includes("PALSU")) {
        showAlert("Sistem Keamanan AI: Foto yang Anda unggah BUKAN merupakan fasilitas publik yang valid (terdeteksi sebagai selfie, hewan peliharaan, layar, dsb). Laporan Ditolak!");
        setBase64Image(null);
        setImagePreview(null);
        setAnalysisResult(null);
        setLoading(false);
        return;
      }

      setAnalysisResult(teksBersih);
    } catch (error) {
      setAnalysisResult("Gagal terhubung ke AI server.");
    } finally {
      setLoading(false);
    }
  };

  // FUNGSI BARU: TERBUNG VIA BACKEND API & MENGIRIM DATA ANALISIS UTUH
  const kirimKeCloud = async () => {
    if (!analysisResult) return;
    
    // --- FITUR: ANTI-SPAM (COOLDOWN 60 DETIK DI TOMBOL FINAL) ---
    const lastReportTime = localStorage.getItem("laporaman_last_report");
    if (lastReportTime) {
      const now = new Date().getTime();
      const diffSeconds = (now - parseInt(lastReportTime)) / 1000;
      if (diffSeconds < 60) {
        showAlert(`Sistem Anti-Spam Aktif: Anda harus menunggu ${Math.ceil(60 - diffSeconds)} detik lagi untuk mengirim laporan baru demi mencegah spamming.`);
        return;
      }
    }

    setIsSending(true);
    setLoadingText("Memeriksa Duplikasi Data Laporan... ☁️");

    // KARENA FOTO SUDAH DI-KOMPRES MENJADI SANGAT KECIL (~150KB - 200KB),
    // KITA BISA LANGSUNG MENYIMPANNYA KE FIRESTORE (Batas maksimal Firestore adalah 1MB/Dokumen).
    let finalImageUrl = base64Image || "";
    
    // --- FITUR: ANTI-DUPLIKAT (Pengecekan Akhir sebelum Masuk Database) ---
    if (imageHashStr) {
      const q = query(collection(db, "laporan"), where("imageHash", "==", imageHashStr));
      const duplicateSnap = await getDocs(q);
      if (!duplicateSnap.empty) {
        showAlert("Sistem Keamanan: Laporan dengan foto yang sama persis sudah masuk ke dalam database kami! Pengiriman ganda ditolak.");
        setIsSending(false);
        setLoadingText("🚀 Kirim Laporan Resmi ke Server Cloud");
        return;
      }
    }
    
    setLoadingText("Menyimpan Data Laporan ke Database Aman... ☁️");

    // 2. SCAN TINGKAT BAHAYA SECARA SPESIFIK MENGGUNAKAN REGEX
    // AI sering mengulang kata "Rendah / Sedang / Tinggi" dalam penjelasannya.
    // Jadi kita hanya mencari teks persis setelah tulisan "Tingkat Bahaya:"
    let tingkatBahaya = "Sedang"; // Default
    const matchBahaya = analysisResult.match(/Tingkat Bahaya:\s*(Rendah|Sedang|Tinggi)/i);
    if (matchBahaya && matchBahaya[1]) {
      // Pastikan formatnya selalu kapital di huruf pertama (Rendah, Sedang, Tinggi)
      tingkatBahaya = matchBahaya[1].charAt(0).toUpperCase() + matchBahaya[1].slice(1).toLowerCase();
    }

    // 3. SCAN INSTANSI TERKAIT
    let instansiTerkait = "Lainnya"; // Default
    const matchInstansi = analysisResult.match(/Instansi Terkait:\s*(Dinas PUPR|PLN|Dishub|PDAM|DLH|Lainnya)/i);
    if (matchInstansi && matchInstansi[1]) {
      // Format kapitalisasi agar rapi
      instansiTerkait = matchInstansi[1];
    }

    // MASUKKAN DATA UTUH TANPA PARSING KAKU KE FIRESTORE CLOUD
    try {
      const generatedTicket = `LPR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      await addDoc(collection(db, "laporan"), {
        pelapor: namaPelapor.trim() || "Anonim",
        lokasi: lokasi || "Lokasi tidak ditentukan",
        masalah: analysisResult, // Seluruh paragraf poin AI tersimpan utuh di sini
        bahaya: tingkatBahaya,
        instansi: instansiTerkait, // Menyimpan tebakan instansi dari AI
        waktu: new Date().toLocaleString("id-ID"),
        status: "Menunggu",
        fotoUrl: finalImageUrl, // Sekarang menyimpan teks base64 langsung! (Anti Gagal)
        imageHash: imageHashStr, // Simpan sidik jari foto
        ticketId: generatedTicket, // Menyimpan ID Tiket untuk fitur pelacakan
        timestamp: serverTimestamp() 
      });
      
      // --- CATAT WAKTU LAPORAN UNTUK ANTI-SPAM ---
      localStorage.setItem("laporaman_last_report", new Date().getTime().toString());
      
      setTicketId(generatedTicket);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Gagal mengirim ke Cloud:", error);
      alert("Gagal mengirim laporan ke server. Coba lagi.");
    } finally {
      setIsSending(false);
      setLoadingText("🚀 Kirim Laporan Resmi ke Server Cloud");
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-50 p-6 flex justify-center relative overflow-hidden font-sans">
      
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center items-center">
        <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-blue-600/10 blur-[100px] mix-blend-screen" />
        <div className="absolute bottom-[10%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-purple-600/10 blur-[100px] mix-blend-screen" />
      </div>

      <div className="max-w-3xl w-full relative z-10">
        
        <div className="bg-white/5 border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-xl p-8 md:p-10 mt-10">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-white/10">
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-tight">
                Buat Laporan Baru
              </h1>
              <p className="text-slate-400 text-sm mt-1">Sistem Deteksi AI LaporAman</p>
            </div>
            <Link href="/">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Kembali
              </button>
            </Link>
          </div>

          <div className="space-y-8">
            {/* Input Nama Pelapor */}
            <div className="flex flex-col gap-3">
              <label className="font-semibold text-slate-300 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Nama Pahlawan Kota (Opsional)
              </label>
              <input 
                type="text" 
                placeholder="Ketik nama Anda (untuk Leaderboard)..." 
                value={namaPelapor}
                onChange={(e) => setNamaPelapor(e.target.value)}
                maxLength={30}
                className="w-full px-5 py-4 border border-white/10 rounded-2xl bg-black/20 text-slate-200 placeholder-slate-500 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition-all"
              />
            </div>

            {/* Input Lokasi */}
            <div className="flex flex-col gap-3">
              <label className="font-semibold text-slate-300 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Lokasi Kejadian
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Ketik lokasi atau klik tombol GPS..." 
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  className="w-full px-5 py-4 border border-white/10 rounded-2xl bg-black/20 text-slate-200 placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all"
                />
                <button 
                  type="button" 
                  onClick={ambilLokasiGPS}
                  className="px-6 py-4 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl text-sm font-bold hover:bg-blue-600/30 hover:border-blue-500/50 transition-all shrink-0 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  Ambil GPS
                </button>
              </div>
            </div>

            {/* Upload Area */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative border-2 border-dashed border-slate-600 hover:border-blue-500/50 rounded-2xl p-10 text-center bg-black/20 hover:bg-black/40 transition-all duration-300">
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-black/50">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-blue-400 font-bold text-lg mb-1">Pilih Foto Kerusakan</span>
                  <span className="text-slate-500 text-sm">Ketuk untuk menelusuri file (JPG, PNG Maks 5MB)</span>
                </label>
              </div>
            </div>

            {/* Image Preview & Analyze Button */}
            {imagePreview && (
              <div className="flex flex-col items-center gap-6 bg-black/20 p-6 rounded-2xl border border-white/5 duration-500">
                <div className="relative w-full max-w-lg h-72 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                  <Image src={imagePreview} alt="Preview" fill style={{ objectFit: 'cover' }} className="hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none rounded-xl"></div>
                </div>
                <button 
                  onClick={analyzeImage} 
                  disabled={loading} 
                  className="relative w-full max-w-lg px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-3 overflow-hidden group"
                >
                  {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {!loading && (
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  <span className="relative z-10">{loading ? "AI Sedang Memindai..." : "Mulai Analisis AI"}</span>
                  {!loading && <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>}
                </button>
              </div>
            )}

            {/* AI Result & Submit Button */}
            {analysisResult && (
              <div className="space-y-6 duration-700">
                <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/30 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-blue-300 mb-4 flex items-center gap-2 text-lg">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                    Laporan Analisis AI
                  </h3>
                  <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm font-mono bg-black/30 p-4 rounded-xl border border-white/5">
                    {analysisResult}
                  </div>
                </div>

                {!isSubmitted ? (
                  <button 
                    onClick={kirimKeCloud}
                    disabled={isSending}
                    className="w-full py-4 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:bg-slate-700 disabled:shadow-none transition-all flex items-center justify-center gap-3 group overflow-hidden relative"
                  >
                    {isSending && (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {!isSending && (
                      <svg className="w-5 h-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                    <span className="relative z-10">{loadingText}</span>
                    {!isSending && <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>}
                  </button>
                ) : (
                  <div className="p-8 bg-emerald-900/20 text-emerald-400 rounded-2xl border border-emerald-500/30 flex flex-col items-center gap-4 shadow-[0_0_30px_rgba(16,185,129,0.15)] text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mb-2">
                      <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-white mb-2">Laporan Berhasil Terkirim!</h4>
                      <p className="text-emerald-500/80 text-sm font-normal mb-6">Data telah diteruskan ke petugas secara realtime.</p>
                      
                      <div className="bg-black/40 p-4 rounded-xl border border-emerald-500/20 mb-4 inline-block w-full max-w-sm">
                        <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Nomor Tiket Anda</p>
                        <div className="text-3xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300 tracking-wider">
                          {ticketId}
                        </div>
                      </div>
                      
                      <p className="text-slate-400 text-xs mt-2">
                        Simpan nomor tiket ini untuk melacak status perbaikan di Halaman Utama.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Alert Modal */}
      {customAlert.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] transform transition-all scale-100 animate-in zoom-in-95">
            <div className={`h-2 w-full ${customAlert.type === 'error' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${customAlert.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">{customAlert.title}</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                {customAlert.message}
              </p>
              <button 
                onClick={() => setCustomAlert({ ...customAlert, isOpen: false })}
                className={`w-full py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${customAlert.type === 'error' ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]'}`}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}