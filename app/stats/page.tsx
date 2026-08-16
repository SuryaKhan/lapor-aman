"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "../firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('../../components/Map'), { 
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-slate-900 rounded-2xl animate-pulse flex items-center justify-center text-slate-500 border border-white/5">Memuat Peta Satelit...</div>
});

interface Report {
  bahaya: string;
  status: string;
  instansi: string;
  id: string;
  lokasi: string;
  masalah: string;
  pelapor: string;
}

export default function PublicStatsPage() {
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "laporan"));
    const unsubscribe = onSnapshot(
      q, 
      (querySnapshot) => {
        const dataLaporan: Report[] = [];
        querySnapshot.forEach((docSnap) => {
          dataLaporan.push({
            id: docSnap.id,
            bahaya: docSnap.data().bahaya || "Rendah",
            status: docSnap.data().status || "Menunggu",
            instansi: docSnap.data().instansi || "Lainnya",
            lokasi: docSnap.data().lokasi || "",
            masalah: docSnap.data().masalah || "Tidak ada detail",
            pelapor: docSnap.data().pelapor || "Anonim",
          });
        });
        setAllReports(dataLaporan);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal menarik data dari Firebase:", error);
        alert("Gagal memuat data! Periksa console browser. Kemungkinan akses 'Read' diblokir oleh Firebase Security Rules.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const totalLaporan = allReports.length;
  const laporanSelesai = allReports.filter(r => r.status === "Selesai").length;
  
  // Data for Instansi Bar Chart
  const instansiCounts = allReports.reduce((acc, curr) => {
    acc[curr.instansi] = (acc[curr.instansi] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barChartData = Object.keys(instansiCounts).map(key => ({
    name: key,
    total: instansiCounts[key],
    fill: key === "PLN" ? "#eab308" : key === "PDAM" ? "#3b82f6" : key === "Dishub" ? "#a855f7" : key === "Dinas PUPR" ? "#f97316" : key === "DLH" ? "#10b981" : "#64748b"
  })).sort((a, b) => b.total - a.total);

  // Leaderboard Data (Pahlawan Kota)
  const leaderboardCounts = allReports.reduce((acc, curr) => {
    let nama = curr.pelapor.trim();
    if (nama && nama.toLowerCase() !== "anonim") {
      nama = nama.charAt(0).toUpperCase() + nama.slice(1).toLowerCase();
      acc[nama] = (acc[nama] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const leaderboardData = Object.keys(leaderboardCounts)
    .map(key => ({ name: key, poin: leaderboardCounts[key] }))
    .sort((a, b) => b.poin - a.poin)
    .slice(0, 5); // Top 5 Pahlawan

  // Parse map markers
  const mapMarkers = allReports.filter(r => r.lokasi.includes("Titik Koordinat:")).map(r => {
    const coordsStr = r.lokasi.replace("Titik Koordinat:", "").trim();
    const [latStr, lngStr] = coordsStr.split(",");
    return {
      id: r.id,
      lat: parseFloat(latStr),
      lng: parseFloat(lngStr),
      bahaya: r.bahaya,
      masalah: r.masalah
    };
  }).filter(m => !isNaN(m.lat) && !isNaN(m.lng));

  return (
    <div className="min-h-screen bg-[#030712] text-slate-50 p-6 flex flex-col items-center relative overflow-x-hidden font-sans">
      
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none flex justify-center items-center">
        <div className="absolute top-0 right-0 w-[40vw] h-[40vw] rounded-full bg-blue-600/10 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] rounded-full bg-emerald-600/10 blur-[120px] mix-blend-screen" />
      </div>

      <div className="max-w-6xl w-full relative z-10 mt-10 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div className="text-center md:text-left">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-4 inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Open Data Center
            </span>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
              Statistik LaporAman
            </h1>
            <p className="text-slate-400 mt-2 max-w-xl">
              Transparansi data pelaporan infrastruktur publik secara real-time. Membangun kepercayaan publik melalui keterbukaan informasi.
            </p>
          </div>
          <Link href="/">
            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Kembali ke Beranda
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-400 animate-pulse font-mono">Menarik data dari satelit pemerintahan...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-900/20 to-transparent p-8 rounded-3xl border border-blue-500/20 backdrop-blur-md flex items-center justify-between">
                <div>
                  <p className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-2">Total Laporan Masuk</p>
                  <p className="text-6xl font-black text-white">{totalLaporan}</p>
                </div>
                <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-900/20 to-transparent p-8 rounded-3xl border border-emerald-500/20 backdrop-blur-md flex items-center justify-between">
                <div>
                  <p className="text-emerald-400 font-bold uppercase tracking-widest text-sm mb-2">Total Laporan Selesai</p>
                  <p className="text-6xl font-black text-white">{laporanSelesai}</p>
                </div>
                <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              
              {/* Pie Chart */}
              <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
                <h3 className="font-bold text-lg text-white mb-6">Distribusi Tingkat Bahaya</h3>
                <div className="h-[300px] w-full relative">
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
                            innerRadius={80}
                            outerRadius={110}
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
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 font-medium">Belum ada data laporan</div>
                  )}
                </div>
              </div>

              {/* Bar Chart - Instansi */}
              <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md">
                <h3 className="font-bold text-lg text-white mb-6">Distribusi per Instansi Terkait (AI Triage)</h3>
                <div className="h-[300px] w-full">
                  {barChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff'}} />
                        <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                          {
                            barChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))
                          }
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 font-medium">Belum ada data laporan</div>
                  )}
                </div>
              </div>

              {/* Leaderboard - Pahlawan Kota */}
              <div className="bg-gradient-to-b from-purple-900/30 to-black/20 p-8 rounded-3xl border border-purple-500/30 backdrop-blur-md">
                <h3 className="font-bold text-lg text-purple-300 mb-6 flex items-center gap-2">
                  <span className="text-2xl">🏆</span> Pahlawan Kota Teraktif
                </h3>
                <div className="space-y-4">
                  {leaderboardData.length > 0 ? (
                    leaderboardData.map((user, index) => (
                      <div key={index} className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            index === 1 ? 'bg-slate-400/20 text-slate-300' :
                            index === 2 ? 'bg-amber-700/20 text-amber-600' :
                            'bg-white/5 text-slate-500'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="font-bold text-slate-200">{user.name}</span>
                        </div>
                        <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold">
                          {user.poin} Laporan
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-3">
                        <span className="text-3xl opacity-50">😴</span>
                      </div>
                      <p className="text-slate-500 text-sm">Belum ada Pahlawan Kota yang terdaftar.</p>
                      <p className="text-slate-600 text-xs mt-1">Lapor kerusakan pakai namamu sekarang!</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Live Map Area */}
            <div className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md mb-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-white">Live Incident Map</h3>
                <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-full">
                  {mapMarkers.length} Titik Terdeteksi
                </span>
              </div>
              <LeafletMap markers={mapMarkers} />
            </div>
          </>
        )}
        
      </div>
    </div>
  );
}
