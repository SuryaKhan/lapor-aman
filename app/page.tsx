"use client";
import Link from 'next/link';
import { useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTicket, setSearchTicket] = useState("");
  const [ticketResult, setTicketResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [isRoasting, setIsRoasting] = useState(false);
  const [roastResult, setRoastResult] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleSearch = async () => {
    if (!searchTicket) return;
    setIsSearching(true);
    setSearchError("");
    setTicketResult(null);
    setRoastResult(null);

    try {
      const q = query(collection(db, "laporan"), where("ticketId", "==", searchTicket.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        setTicketResult({ ...data, id: querySnapshot.docs[0].id });
      } else {
        setSearchError("Tiket tidak ditemukan. Pastikan nomor tiket benar (contoh: LPR-XXXXX).");
      }
    } catch (error) {
      setSearchError("Terjadi kesalahan koneksi server.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpvote = async () => {
    if (!ticketResult || !ticketResult.id) return;
    
    // Check if already upvoted
    const upvotedStr = localStorage.getItem('laporaman_upvotes') || '[]';
    const upvotedTickets = JSON.parse(upvotedStr);
    if (upvotedTickets.includes(ticketResult.id)) {
      showToast("Anda sudah memberikan dukungan pada laporan ini.");
      return;
    }

    setIsUpvoting(true);
    try {
      const ticketRef = doc(db, "laporan", ticketResult.id);
      await updateDoc(ticketRef, {
        upvotes: increment(1)
      });
      
      // Update UI optimistically
      setTicketResult({ ...ticketResult, upvotes: (ticketResult.upvotes || 0) + 1 });
      
      // Save to local storage
      upvotedTickets.push(ticketResult.id);
      localStorage.setItem('laporaman_upvotes', JSON.stringify(upvotedTickets));
    } catch (error) {
      console.error("Gagal upvote:", error);
      showToast("Gagal memberikan dukungan. Silakan coba lagi.");
    } finally {
      setIsUpvoting(false);
    }
  };

  const handleRoast = async () => {
    if (!ticketResult) return;
    setIsRoasting(true);
    setRoastResult(null);
    try {
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lokasi: ticketResult.lokasi,
          masalah: ticketResult.masalah,
          instansi: ticketResult.instansi
        })
      });
      const data = await response.json();
      if (data.result) {
        setRoastResult(data.result);
      } else if (data.details && data.details.includes("429")) {
        showToast("Server AI sedang penuh (Limit). Tunggu 5-10 detik ya!");
      } else {
        showToast("Gagal melakukan roasting.");
      }
    } catch (e) {
      showToast("Terjadi kesalahan jaringan.");
    } finally {
      setIsRoasting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#030712] text-slate-50 font-sans selection:bg-blue-500/30 overflow-hidden relative flex flex-col items-center">
      
      {/* Background decorations - Animated gradients and grid */}
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center items-center">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/20 blur-[100px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen" />
        <div className="absolute top-[20%] right-[20%] w-[20vw] h-[20vw] rounded-full bg-emerald-500/10 blur-[80px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f1a_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f1a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-32 pb-24 flex flex-col items-center text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-10 hover:bg-white/10 hover:border-white/20 transition-all cursor-default">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></span>
          </span>
          <span className="text-sm font-semibold text-blue-100 tracking-wide">AI-Powered Road Safety v2.0</span>
        </div>

        {/* Hero Heading */}
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight mb-8 drop-shadow-2xl">
          Lapor
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500">
            Aman
          </span>
          <span className="font-light text-slate-300"> AI</span>
        </h1>
        
        {/* Hero Description */}
        <p className="text-lg md:text-xl text-slate-300/80 max-w-2xl leading-relaxed mb-12">
          Revolusi pelaporan infrastruktur publik. Unggah foto kerusakan jalan, dan biarkan kecerdasan buatan kami menganalisis tingkat bahayanya secara instan untuk respon perbaikan yang presisi.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-5 w-full max-w-3xl justify-center relative">
          {/* Glow effect behind buttons */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 blur-2xl opacity-20 scale-110 rounded-full z-0 pointer-events-none"></div>
          
          <Link href="/lapor" className="w-full sm:w-auto relative z-10 group flex-1">
            <button className="w-full h-full px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.8)] flex items-center justify-center gap-3 border border-blue-400/30 overflow-hidden relative">
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
              <span className="relative z-10 whitespace-nowrap">Lapor Baru</span>
              <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </Link>
          
          <div className="w-full sm:w-auto relative z-10 group flex-1">
            <button onClick={() => setIsModalOpen(true)} className="w-full h-full px-6 py-4 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-bold rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] flex items-center justify-center gap-3 border border-purple-500/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="whitespace-nowrap">Lacak</span>
            </button>
          </div>

          <Link href="/stats" className="w-full sm:w-auto relative z-10 group flex-1">
            <button className="w-full h-full px-6 py-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-3 border border-emerald-500/30">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="whitespace-nowrap">Statistik Publik</span>
            </button>
          </Link>

          <Link href="/dashboard" className="w-full sm:w-auto relative z-10 group flex-1">
            <button className="w-full h-full px-6 py-4 bg-[#0a101f]/80 border border-slate-700 hover:border-slate-500 text-slate-200 font-bold rounded-2xl transition-all duration-300 backdrop-blur-xl flex items-center justify-center gap-3 hover:bg-[#111827]">
              <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="whitespace-nowrap">Admin</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Features/Steps Section */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          
          {/* Step 1 */}
          <div className="group p-8 rounded-[2rem] bg-gradient-to-b from-white/5 to-transparent border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <span className="text-2xl font-black text-blue-400">1</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-3 tracking-tight">Potret Kerusakan</h3>
            <p className="text-slate-400 leading-relaxed font-medium">
              Temukan jalan berlubang atau fasilitas rusak. Ambil foto dengan jelas menggunakan perangkat Anda.
            </p>
          </div>

          {/* Step 2 */}
          <div className="group p-8 rounded-[2rem] bg-gradient-to-b from-white/5 to-transparent border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <span className="text-2xl font-black text-purple-400">2</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-3 tracking-tight">AI Menganalisis</h3>
            <p className="text-slate-400 leading-relaxed font-medium">
              Sistem kecerdasan buatan kami langsung mendeteksi tingkat keparahan dan urgensi dari foto Anda.
            </p>
          </div>

          {/* Step 3 */}
          <div className="group p-8 rounded-[2rem] bg-gradient-to-b from-white/5 to-transparent border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <span className="text-2xl font-black text-emerald-400">3</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-3 tracking-tight">Tindakan Cepat</h3>
            <p className="text-slate-400 leading-relaxed font-medium">
              Laporan masuk ke Command Center secara real-time untuk segera ditindaklanjuti oleh petugas lapangan.
            </p>
          </div>

        </div>
      </div>
      
      <footer className="relative z-10 w-full py-8 border-t border-white/5 text-center flex flex-col items-center gap-2 mt-auto">
        <p className="text-slate-500/80 text-sm font-medium tracking-wide">
          © 2026 LaporAman AI. Inovasi Keselamatan Publik.
        </p>
      </footer>

      {/* Modal Lacak Tiket */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl transform transition-all">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-800 shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Lacak Status Laporan
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex gap-3 mb-6">
                <input 
                  type="text" 
                  placeholder="Masukkan Nomor Tiket (Misal: LPR-X8Y9Z)"
                  value={searchTicket}
                  onChange={(e) => setSearchTicket(e.target.value.toUpperCase())}
                  className="flex-1 px-5 py-4 bg-black/40 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono tracking-wider"
                />
                <button 
                  onClick={handleSearch}
                  disabled={isSearching || !searchTicket}
                  className="px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                >
                  {isSearching ? 'Mencari...' : 'Cari'}
                </button>
              </div>

              {searchError && (
                <div className="p-4 mb-4 bg-red-900/30 border border-red-500/30 text-red-400 rounded-xl text-sm">
                  {searchError}
                </div>
              )}

              {ticketResult && (
                <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-5 space-y-5 animate-fade-in">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-400 text-xs uppercase mb-1">Tiket Valid</p>
                      <h4 className="text-2xl font-mono font-bold text-blue-400">{ticketResult.ticketId || searchTicket}</h4>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                      ticketResult.status === 'Selesai' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      ticketResult.status === 'Diproses' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {ticketResult.status}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div>
                      <p className="text-slate-500 text-xs">Lokasi</p>
                      <p className="text-slate-300 text-sm line-clamp-1">{ticketResult.lokasi}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Waktu Lapor</p>
                      <p className="text-slate-300 text-sm">{ticketResult.waktu}</p>
                    </div>
                  </div>
                  
                  {/* Upvote Button */}
                  <div className="pt-2">
                    <button 
                      onClick={handleUpvote}
                      disabled={isUpvoting || ticketResult.status === 'Selesai'}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition-all disabled:opacity-50 font-semibold"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      {isUpvoting ? 'Memproses...' : 'Dukung Laporan Ini (Mendesak)'}
                      {ticketResult.upvotes > 0 && (
                        <span className="ml-2 bg-indigo-500/30 px-2 py-0.5 rounded-md text-xs">
                          {ticketResult.upvotes} Dukungan
                        </span>
                      )}
                    </button>
                    
                    {/* Roast AI Button */}
                    <button 
                      onClick={handleRoast}
                      disabled={isRoasting}
                      className="w-full flex items-center justify-center gap-2 py-3 mt-3 bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 rounded-xl transition-all disabled:opacity-50 font-semibold group"
                    >
                      <span className="text-xl group-hover:scale-125 transition-transform">🔥</span>
                      {isRoasting ? 'AI Sedang Menyusun Kata-kata Pedas...' : 'Roast Instansi Terkait (AI)'}
                    </button>
                  </div>

                  {/* Roast Result */}
                  {roastResult && (
                    <div className="mt-4 p-5 bg-gradient-to-br from-orange-950/50 to-red-950/50 border border-orange-500/30 rounded-2xl animate-in slide-in-from-top-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🎙️</span>
                        <h4 className="font-bold text-orange-400 text-sm uppercase tracking-widest">AI Stand-up Comedy</h4>
                      </div>
                      <p className="text-orange-100/90 text-sm italic leading-relaxed border-l-2 border-orange-500 pl-3">
                        "{roastResult}"
                      </p>
                      <div className="mt-4 flex gap-3">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(roastResult);
                            showToast("Teks roasting berhasil disalin! 🐦");
                          }}
                          className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors border border-white/10"
                        >
                          Copy Teks
                        </button>
                        <a 
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(roastResult + "\n\n#LaporAman #WargaNgeluh")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 text-[#1DA1F2] border border-[#1DA1F2]/30 rounded-lg text-xs font-bold transition-colors text-center"
                        >
                          Share ke X / Twitter
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Progress Timeline UI */}
                  <div className="relative pt-6 pb-2">
                    <div className="absolute left-0 top-9 w-full h-1 bg-slate-800 rounded-full"></div>
                    <div className={`absolute left-0 top-9 h-1 rounded-full transition-all duration-1000 ${
                      ticketResult.status === 'Selesai' ? 'w-full bg-emerald-500' :
                      ticketResult.status === 'Diproses' ? 'w-1/2 bg-blue-500' :
                      'w-[10%] bg-amber-500'
                    }`}></div>
                    
                    <div className="relative flex justify-between">
                      <div className="flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-amber-500 ring-4 ring-slate-900 z-10 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                        <p className="text-[10px] mt-2 text-amber-400 font-bold">Dilaporkan</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full ring-4 ring-slate-900 z-10 transition-colors ${
                          ticketResult.status === 'Diproses' || ticketResult.status === 'Selesai' 
                          ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800'
                        }`}></div>
                        <p className={`text-[10px] mt-2 font-bold ${
                          ticketResult.status === 'Diproses' || ticketResult.status === 'Selesai' ? 'text-blue-400' : 'text-slate-600'
                        }`}>Diproses</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full ring-4 ring-slate-900 z-10 transition-colors ${
                          ticketResult.status === 'Selesai' 
                          ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800'
                        }`}></div>
                        <p className={`text-[10px] mt-2 font-bold ${
                          ticketResult.status === 'Selesai' ? 'text-emerald-400' : 'text-slate-600'
                        }`}>Selesai</p>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white rounded-full shadow-2xl animate-in slide-in-from-bottom-5 fade-in flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </main>
  )
}