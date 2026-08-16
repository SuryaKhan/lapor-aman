# 🏙️ LaporAman - Smart City AI Infrastructure Triage

LaporAman adalah platform pelaporan infrastruktur publik (*Smart City*) bertenaga AI yang dirancang untuk memangkas birokrasi berhari-hari menjadi hitungan detik. Dibangun menggunakan Next.js, Firebase, dan Google Gemini AI.

![LaporAman Dashboard](https://img.shields.io/badge/Status-Production_Ready-success)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Gemini AI](https://img.shields.io/badge/Google_Gemini-2.5_Flash-blue)

## ✨ Fitur Utama (Enterprise-Grade)

1. **🤖 AI Smart Triage (Auto-Routing)**
   Warga cukup memfoto jalan berlubang atau tiang listrik patah. AI Gemini akan menganalisis gambar secara *real-time* dan otomatis meneruskan laporan ke laci dinas yang tepat (Dinas PUPR, PLN, PDAM, Dishub, dll). Warga tidak perlu tahu birokrasi!

2. **🛡️ Keamanan Siber Lapis Ganda (Anti-Spam & Anti-Fake)**
   - **AI Fake-Detector**: Otomatis menolak foto palsu (selfie, hewan peliharaan, foto layar monitor).
   - **SHA-256 Image Hashing**: Mencegah warga mengirimkan foto/laporan ganda yang sama persis (Anti-Duplikat).
   - **Time-based Cooldown**: Mencegah serangan *spamming* ke server.

3. **✉️ Magic SPK Generator (Auto-Draft Surat Dinas)**
   Di Dashboard Admin, AI dapat langsung mengetikkan draf Surat Perintah Kerja (SPK) resmi lengkap dengan kop surat pemerintahan berdasarkan analisis foto, siap di-*copy* ke Microsoft Word.

4. **🗺️ Live Incident Map (Real-world GPS)**
   Sistem terintegrasi dengan sensor GPS perangkat (Geolocator API) dan menampilkan sebaran laporan secara visual di atas peta nyata (Leaflet + OpenStreetMap + CartoDB Dark).

5. **💬 AI Command Center Chatbot**
   Asisten eksekutif khusus Admin yang mampu membaca keseluruhan *database* kota untuk menjawab pertanyaan analitik (contoh: "Ada berapa laporan jalan berlubang hari ini?"). Dilengkapi sistem *Anti-Out-of-Topic* ketat.

6. **⚡ Client-Side Image Compression**
   Kompresi gambar instan di memori HP pengguna (dari 10MB menjadi ~200KB) sebelum dikirim, menghemat kuota warga dan mengamankan kapasitas *database* server (Firestore).

## 🚀 Teknologi yang Digunakan
- **Frontend**: Next.js (App Router), React, TailwindCSS
- **Backend & Database**: Firebase Firestore (NoSQL)
- **Kecerdasan Buatan**: Google Generative AI SDK (Gemini 2.5 Flash)
- **Pemetaan**: Leaflet, React-Leaflet
- **Visualisasi Data**: Recharts

## 💡 Konsep Bisnis & Solusi
Di banyak kota, birokrasi pelaporan warga memakan waktu berminggu-minggu karena laporan harus disortir manual oleh manusia. Dengan LaporAman, asisten AI bertindak sebagai *dispatcher* super cepat yang mengotomatisasi penyortiran, penilaian tingkat bahaya, dan pembuatan surat pengantar kerja. Sistem ini memangkas biaya operasional dan mempercepat respon perbaikan infrastruktur.

---
*Dibuat untuk kompetisi #JuaraVibeCoding*
