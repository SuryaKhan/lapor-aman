"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db, auth } from "../firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Report {
  id: string;
  lokasi: string;
  masalah: string;
  bahaya: string;
  waktu: string;
  status: string;
  fotoUrl: string;
  instansi?: string;
  ticketId?: string;
}

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true); // Mulai dengan true karena mengecek Firebase session
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  
  const [allReports, setAllReports] = useState<Report[]>([]);
  
  // Filter & Modal State
  const [filter, setFilter] = useState("Aktif"); // Aktif, Semua, Menunggu, Diproses, Selesai
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [isDraftingSurat, setIsDraftingSurat] = useState(false);
  const [draftedSurat, setDraftedSurat] = useState("");
  
  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{sender: string, text: string}[]>([
    {sender: "ai", text: "Halo Admin Command Center! Saya Asisten AI LaporAman. Ingin saya bantu merekap data kerusakan kota hari ini?"}
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    // Mengecek apakah admin sudah login sebelumnya di Firebase
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setIsAuthenticating(false);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, "laporan"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const dataLaporan: Report[] = [];
      querySnapshot.forEach((docSnap) => {
        dataLaporan.push({
          id: docSnap.id,
          lokasi: docSnap.data().lokasi,
          masalah: docSnap.data().masalah || "Infrastruktur Rusak (Detail menyusul)", 
          bahaya: docSnap.data().bahaya,
          waktu: docSnap.data().waktu,
          status: docSnap.data().status,
          fotoUrl: docSnap.data().fotoUrl || "",
          instansi: docSnap.data().instansi || "Lainnya",
          ticketId: docSnap.data().ticketId || ""
        });
      });
      setAllReports(dataLaporan);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    
    try {
      if (isRegistering) {
        if (secretCode !== "LAPORAMAN-RAHASIA") {
          alert("Akses Ditolak: Kode Rahasia Sistem salah.");
          setIsAuthenticating(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Pendaftaran Admin berhasil! Anda langsung masuk ke Command Center.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      alert("Autentikasi Gagal: " + error.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const updateStatusCloud = async (id: string, statusBaru: string) => {
    try {
      const reportRef = doc(db, "laporan", id);
      await updateDoc(reportRef, {
        status: statusBaru
      });
      
      // Show toast
      setToastMsg(`Status berhasil diubah menjadi: ${statusBaru}`);
      setTimeout(() => setToastMsg(""), 3000);
      
      // Update modal local state if open
      if (selectedReport && selectedReport.id === id) {
        setSelectedReport({ ...selectedReport, status: statusBaru });
      }
    } catch (error) {
      console.error("Gagal update status:", error);
      alert("Gagal mengubah status di server Cloud.");
    }
  };

  const handleExportCSV = () => {
    // 1. Tambahkan BOM (Byte Order Mark) agar Excel bisa membaca Emoji & karakter unik
    const BOM = "\uFEFF";
    
    // 2. Gunakan pemisah Titik Koma (;) karena Excel regional Indonesia default-nya titik koma
    const separator = ";";
    
    const headers = ["ID Laporan", "Tanggal", "Lokasi", "Tingkat Bahaya", "Instansi Terkait", "Status", "Deskripsi Analisis AI"];
    const csvRows = allReports.map(r => {
      // 3. Bersihkan teks: Hapus kutip ganda nakal, dan ubah ENTER (\n) menjadi pemisah spasi (|)
      const escape = (text: string) => {
        if (!text) return '""';
        const cleanText = text.replace(/"/g, '""').replace(/\n/g, ' | ').replace(/\r/g, '');
        return `"${cleanText}"`;
      };

      return [
        escape(r.id),
        escape(r.waktu),
        escape(r.lokasi),
        escape(r.bahaya),
        escape(r.instansi || "Lainnya"),
        escape(r.status),
        escape(r.masalah)
      ].join(separator);
    });
    
    const csvContent = [headers.join(separator), ...csvRows].join("\n");
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `LaporAman_Rekap_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDraftSurat = async () => {
    if (!selectedReport) return;
    setIsDraftingSurat(true);
    setDraftedSurat("");
    try {
      const response = await fetch("/api/draft-surat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDetails: selectedReport.masalah,
          instansi: selectedReport.instansi || "Lainnya",
          lokasi: selectedReport.lokasi
        })
      });
      const data = await response.json();
      if (data.result) {
        setDraftedSurat(data.result);
        setToastMsg("Surat berhasil dibuat oleh AI!");
        setTimeout(() => setToastMsg(""), 3000);
      } else {
        setToastMsg(data.error || "Gagal membuat surat.");
        setTimeout(() => setToastMsg(""), 3000);
      }
    } catch (e) {
      setToastMsg("Terjadi kesalahan sistem saat menghubungi AI.");
      setTimeout(() => setToastMsg(""), 3000);
    } finally {
      setIsDraftingSurat(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    
    const newMsg = { sender: "admin", text: chatInput };
    const currentHistory = [...chatMessages, newMsg];
    
    setChatMessages(currentHistory);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: newMsg.text,
          chatHistory: chatMessages, 
          // Hapus fotoUrl (base64) karena ukurannya memakan MBs dan bikin error Payload Too Large
          reportsData: allReports.map(r => ({
            id: r.id,
            lokasi: r.lokasi,
            masalah: r.masalah,
            bahaya: r.bahaya,
            instansi: r.instansi,
            status: r.status,
            waktu: r.waktu,
            ticketId: r.ticketId
          }))
        })
      });
      
      const data = await response.json();
      if (data.result) {
        setChatMessages([...currentHistory, { sender: "ai", text: data.result }]);
      } else {
        setChatMessages([...currentHistory, { sender: "ai", text: "Maaf, terjadi kesalahan saat menghubungi server AI." }]);
      }
    } catch (e) {
      setChatMessages([...currentHistory, { sender: "ai", text: "Maaf, gagal menghubungi sistem AI Kota." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Dramatic Background grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f15_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f15_1px,transparent_1px)] bg-[size:30px_30px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] z-0"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen animate-pulse z-0"></div>
        
        <div className="bg-black/40 border border-white/10 p-10 rounded-[2rem] shadow-[0_0_50px_rgba(37,99,235,0.1)] backdrop-blur-2xl max-w-md w-full relative z-10 animate-in zoom-in-95 duration-500">
          
          {isAuthenticating ? (
            <div className="flex flex-col items-center justify-center h-[300px] space-y-6">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                <div className="absolute w-16 h-16 border-b-4 border-purple-500 rounded-full animate-spin direction-reverse"></div>
                <svg className="w-8 h-8 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-blue-400 font-bold tracking-widest uppercase text-sm animate-pulse">Authenticating...</p>
                <p className="text-slate-500 text-xs mt-2 font-mono">Verifying secure connection to Cloud Server</p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/30 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                  <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">Security System</h2>
                <p className="text-slate-400 text-sm mt-2 font-medium tracking-widest uppercase">Command Center LaporAman</p>
              </div>
              
              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Email Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input 
                    type="email" 
                    placeholder="Email Admin..." 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-black/50 border border-white/10 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-slate-600 font-mono tracking-wider"
                  />
                </div>

                {/* Password Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input 
                    type="password" 
                    placeholder="Password..." 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-black/50 border border-white/10 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-slate-600 font-mono tracking-wider"
                  />
                </div>

                {/* Secret Code (Hanya muncul jika sedang mode Daftar Admin) */}
                {isRegistering && (
                  <div className="relative group animate-in slide-in-from-top-2">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-amber-500 group-focus-within:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Kode Rahasia Pendaftaran..." 
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-4 bg-amber-500/10 border border-amber-500/30 text-amber-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all placeholder-amber-700/50 font-mono tracking-wider"
                    />
                  </div>
                )}

                <button type="submit" className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] flex items-center justify-center gap-2 group relative overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                  <span className="relative z-10 tracking-wide">{isRegistering ? "Daftarkan Admin Baru" : "Akses Sistem"}</span>
                  <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>

              {/* Toggle Register */}
              <div className="mt-6 text-center">
                <button 
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-xs text-slate-500 hover:text-white transition-colors"
                >
                  {isRegistering ? "Sudah punya akun? Login di sini." : "Admin Baru? Daftar menggunakan Kode Rahasia."}
                </button>
              </div>

              <div className="mt-8 text-center border-t border-white/5 pt-6">
                <Link href="/" className="text-sm text-slate-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Kembali ke Beranda
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Filter Logic
  const filteredReports = allReports.filter((r) => {
    if (filter === "Semua") return true;
    if (filter === "Aktif") return r.status !== "Selesai";
    if (filter === "Kritis") return r.bahaya === "Tinggi" && r.status !== "Selesai";
    return r.status === filter;
  });

  const totalLaporan = allReports.length;
  const laporanKritis = allReports.filter(r => r.bahaya === "Tinggi" && r.status !== "Selesai").length;
  const laporanSelesai = allReports.filter(r => r.status === "Selesai").length;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-50 font-sans relative overflow-x-hidden">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-emerald-500/90 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] backdrop-blur-md flex items-center gap-3 font-bold border border-emerald-400/50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            {toastMsg}
          </div>
        </div>
      )}

      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center items-center">
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] rounded-full bg-blue-600/5 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] rounded-full bg-purple-600/5 blur-[120px] mix-blend-screen" />
      </div>

      <nav className="relative z-10 bg-black/40 border-b border-white/10 backdrop-blur-xl p-4 flex justify-between items-center sticky top-0">
        <div className="flex items-center gap-4 px-2">
          <div className="font-black text-2xl tracking-tight text-white drop-shadow-md">
            Lapor<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Aman</span>
          </div>
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(96,165,250,0.8)]"></span>
            Command Center
          </span>
        </div>
        <button onClick={() => signOut(auth)} className="text-sm bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 font-semibold transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </nav>

      <div className="relative z-10 max-w-[90rem] mx-auto p-6 space-y-8 mt-6">
        
        {/* KPI Cards */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Live Dashboard
            </h1>
            <button onClick={handleExportCSV} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-white/5 p-6 rounded-2xl shadow-xl border border-white/10 flex items-center gap-5 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-500/20 transition-colors"></div>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Total Laporan</p>
                <p className="text-4xl font-black text-white mt-1">{totalLaporan}</p>
              </div>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl shadow-xl border border-white/10 flex items-center gap-5 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-red-500/20 transition-colors"></div>
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-400 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)] group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Kondisi Kritis</p>
                <p className="text-4xl font-black text-red-400 mt-1">{laporanKritis}</p>
              </div>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl shadow-xl border border-white/10 flex items-center gap-5 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-500/20 transition-colors"></div>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)] group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Diselesaikan</p>
                <p className="text-4xl font-black text-emerald-400 mt-1">{laporanSelesai}</p>
              </div>
            </div>

          </div>
        </div>

        {/* New Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Pie Chart - Danger Level */}
          <div className="bg-white/5 p-6 rounded-2xl shadow-xl border border-white/10 backdrop-blur-md">
            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-6 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Rasio Tingkat Bahaya
            </h3>
            <div className="h-[220px] w-full relative">
              {totalLaporan > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Tinggi', value: allReports.filter(r => r.bahaya === 'Tinggi').length, color: '#ef4444' },
                          { name: 'Sedang', value: allReports.filter(r => r.bahaya === 'Sedang').length, color: '#f97316' },
                          { name: 'Rendah', value: allReports.filter(r => r.bahaya === 'Rendah').length, color: '#10b981' },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {
                          [
                            { name: 'Tinggi', value: allReports.filter(r => r.bahaya === 'Tinggi').length, color: '#ef4444' },
                            { name: 'Sedang', value: allReports.filter(r => r.bahaya === 'Sedang').length, color: '#f97316' },
                            { name: 'Rendah', value: allReports.filter(r => r.bahaya === 'Rendah').length, color: '#10b981' },
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.05)" />
                          ))
                        }
                      </Pie>
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff'}} itemStyle={{color: '#fff'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <span className="text-3xl font-black text-white">{totalLaporan}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">Total</span>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-medium">Belum ada data</div>
              )}
            </div>
          </div>

          {/* Bar Chart - Status */}
          <div className="bg-white/5 p-6 rounded-2xl shadow-xl border border-white/10 backdrop-blur-md">
            <h3 className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-6 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Progress Penyelesaian
            </h3>
            <div className="h-[220px] w-full">
              {totalLaporan > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Menunggu', total: allReports.filter(r => r.status === 'Menunggu').length, fill: '#f59e0b' },
                    { name: 'Diproses', total: allReports.filter(r => r.status === 'Diproses').length, fill: '#3b82f6' },
                    { name: 'Selesai', total: allReports.filter(r => r.status === 'Selesai').length, fill: '#10b981' },
                  ]}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff'}} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {
                        [
                          { name: 'Menunggu', total: allReports.filter(r => r.status === 'Menunggu').length, fill: '#f59e0b' },
                          { name: 'Diproses', total: allReports.filter(r => r.status === 'Diproses').length, fill: '#3b82f6' },
                          { name: 'Selesai', total: allReports.filter(r => r.status === 'Selesai').length, fill: '#10b981' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-medium">Belum ada data</div>
              )}
            </div>
          </div>

        </div>        {/* Data Table */}
        <div className="bg-black/20 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="font-bold text-lg text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Daftar Laporan Infrastruktur
            </h2>
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap bg-white/5 p-1 rounded-xl border border-white/10 w-full lg:w-auto overflow-hidden">
              {["Aktif", "Semua", "Kritis", "Menunggu", "Diproses", "Selesai"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 md:flex-none px-2 sm:px-4 py-2 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                    filter === f 
                    ? "bg-blue-600 text-white shadow-md" 
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-widest border-b border-white/10">
                  <th className="p-5 font-bold">Foto Bukti</th>
                  <th className="p-5 font-bold">Kode, Lokasi & Instansi</th>
                  <th className="p-5 font-bold">Analisis AI Singkat</th>
                  <th className="p-5 font-bold text-center">Tingkat Bahaya</th>
                  <th className="p-5 font-bold text-center">Aksi / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 font-medium">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Tidak ada data yang sesuai filter ini.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/[0.04] transition-colors group cursor-pointer" onClick={() => setSelectedReport(report)}>
                      
                      <td className="p-5" onClick={(e) => e.stopPropagation()}>
                        {report.fotoUrl ? (
                          <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 shadow-lg group-hover:border-blue-500/50 transition-all relative">
                            <img src={report.fotoUrl} alt="Bukti Rusak" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                          </div>
                        ) : (
                          <div className="w-20 h-20 bg-black/40 rounded-xl flex flex-col items-center justify-center text-[10px] text-slate-500 text-center border border-white/5">
                            Tanpa Foto
                          </div>
                        )}
                      </td>

                      <td className="p-5">
                        <div className="flex flex-col gap-2">
                          {report.ticketId && (
                            <span className="text-blue-400 font-mono text-xs font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 self-start">
                              {report.ticketId}
                            </span>
                          )}
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-red-400 mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-slate-200 text-sm font-semibold max-w-[200px] line-clamp-2 leading-relaxed" title={report.lokasi}>
                              {report.lokasi}
                            </span>
                          </div>
                          <span className={`inline-flex self-start px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            report.instansi === "PLN" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                            report.instansi === "PDAM" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            report.instansi === "Dishub" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                            report.instansi === "Dinas PUPR" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                            report.instansi === "DLH" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }`}>
                            {report.instansi || "Lainnya"}
                          </span>
                        </div>
                      </td>

                      <td className="p-5 max-w-xs">
                        <p className="text-slate-400 text-sm font-medium line-clamp-2 bg-black/30 p-2 rounded-lg border border-white/5">
                          {report.masalah}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {report.waktu}
                        </div>
                      </td>

                      <td className="p-5 text-center">
                        <span className={`inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-xs font-bold border ${
                          report.bahaya === "Tinggi" 
                          ? "bg-red-500/10 text-red-400 border-red-500/20" 
                          : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        }`}>
                          {report.bahaya === "Tinggi" ? (
                            <><span className="w-2 h-2 rounded-full bg-red-400 mr-2 animate-pulse"></span>TINGGI</>
                          ) : (
                            <><span className="w-2 h-2 rounded-full bg-orange-400 mr-2"></span>SEDANG</>
                          )}
                        </span>
                      </td>

                      <td className="p-5 text-center">
                        <button className="px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 w-full">
                          <span>Lihat Detail</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL OVERLAY */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedReport(null)}></div>
          
          {/* Modal Content */}
          <div className="relative bg-[#0a101f] border border-white/10 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Detail Laporan Infrastruktur
              </h3>
              <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-white bg-white/5 hover:bg-red-500/20 hover:text-red-400 p-2 rounded-xl transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Column: Image & Location */}
                <div className="space-y-6">
                  {/* Image */}
                  <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/50 aspect-video relative group">
                    {selectedReport.fotoUrl ? (
                      <a href={selectedReport.fotoUrl} target="_blank" rel="noopener noreferrer" title="Buka Gambar Resolusi Penuh">
                        <img src={selectedReport.fotoUrl} alt="Foto Kerusakan" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white px-4 py-2 rounded-lg text-sm font-medium border border-white/20 flex items-center gap-2 backdrop-blur-sm transition-all transform translate-y-4 group-hover:translate-y-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                            Perbesar Gambar
                          </span>
                        </div>
                      </a>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-500">Tidak ada foto yang dilampirkan</div>
                    )}
                  </div>

                  {/* Location Info */}
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Informasi Tiket & Lokasi</h4>
                    <div className="space-y-3">
                      {selectedReport.ticketId && (
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <p className="text-purple-400 font-mono text-sm font-bold tracking-widest">{selectedReport.ticketId}</p>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <p className="text-slate-200 text-sm font-medium">{selectedReport.lokasi}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-slate-200 text-sm font-medium">{selectedReport.waktu}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: AI Analysis & Actions */}
                <div className="space-y-6 flex flex-col h-full">
                  
                  {/* AI Output */}
                  <div className="flex-1 bg-gradient-to-br from-blue-900/20 to-purple-900/10 border border-blue-500/20 p-6 rounded-2xl relative">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Laporan Analisis AI Lengkap
                      </h4>
                      <span className={`px-3 py-1 rounded-md text-xs font-bold border ${
                        selectedReport.bahaya === "Tinggi" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                      }`}>
                        Level: {selectedReport.bahaya.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono p-4 bg-black/40 rounded-xl border border-white/5 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                      {selectedReport.masalah}
                    </div>
                  </div>

                  {/* AI Draft Surat */}
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Pencetak Surat Otomatis</h4>
                      {!draftedSurat && (
                        <button 
                          onClick={handleDraftSurat} 
                          disabled={isDraftingSurat}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
                        >
                          {isDraftingSurat ? "AI sedang mengetik..." : "Buat Surat Dinas (AI)"}
                        </button>
                      )}
                    </div>
                    
                    {draftedSurat && (
                      <div className="relative">
                        <textarea 
                          readOnly 
                          value={draftedSurat}
                          className="w-full h-[150px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-300 scrollbar-thin focus:outline-none"
                        />
                        <button 
                          onClick={() => {navigator.clipboard.writeText(draftedSurat); alert("Teks berhasil di-copy!");}} 
                          className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] rounded"
                        >
                          Copy Teks
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Admin Actions */}
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/5 mt-auto">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Ubah Status Laporan</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {selectedReport.status === "Menunggu" && (
                        <button onClick={() => updateStatusCloud(selectedReport.id, "Diproses")} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          Tandai Sedang Diproses
                        </button>
                      )}
                      
                      {selectedReport.status === "Diproses" && (
                        <button onClick={() => updateStatusCloud(selectedReport.id, "Selesai")} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          Tandai Telah Selesai
                        </button>
                      )}

                      {selectedReport.status === "Selesai" && (
                        <div className="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          Laporan Telah Ditutup
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- AI CHATBOT UI --- */}
      {/* Floating Button */}
      {!isChatOpen && isAuthenticated && (
        <button 
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center border border-white/20"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 h-[500px] bg-[#0A0F1C] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8">
          {/* Header */}
          <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50 relative">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full"></div>
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">AI Command Center</h3>
                <p className="text-[10px] text-emerald-400">Online • Supervised AI</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 custom-scrollbar bg-black/20">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed ${
                  msg.sender === "admin" 
                    ? "bg-blue-600 text-white rounded-tr-none" 
                    : "bg-white/10 text-slate-200 border border-white/5 rounded-tl-none"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/5 p-3 rounded-xl rounded-tl-none flex gap-1 items-center">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 bg-white/5 border-t border-white/10 shrink-0">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                placeholder="Tanya soal data laporan..." 
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
              />
              <button 
                onClick={handleSendChat}
                disabled={isChatLoading || !chatInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded-xl text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-slate-500 text-center mt-2">
              AI dapat membaca data kota. Jaga kerahasiaan.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}