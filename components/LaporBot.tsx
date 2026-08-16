"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function LaporBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ sender: "user" | "ai", text: string }[]>([
    { sender: "ai", text: "Halo Pahlawan Kota! Saya LaporBot. Ada yang bisa saya bantu terkait pelaporan fasilitas publik?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Scroll to bottom every time messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput("");
    
    const newMessages = [...messages, { sender: "user", text: userMsg } as const];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/public-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg, chatHistory: newMessages.slice(0, -1) }),
      });
      const data = await response.json();
      
      if (data.result) {
        setMessages([...newMessages, { sender: "ai", text: data.result }]);
      } else {
        setMessages([...newMessages, { sender: "ai", text: "Maaf, server sedang sibuk. Coba lagi nanti ya." }]);
      }
    } catch (error) {
      setMessages([...newMessages, { sender: "ai", text: "Terjadi kesalahan jaringan." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <>
      {/* Chat Window */}
      <div 
        className={`fixed bottom-24 right-6 w-[350px] bg-[#0a101f]/90 backdrop-blur-xl border border-blue-500/30 rounded-3xl shadow-[0_0_40px_rgba(37,99,235,0.2)] overflow-hidden transition-all duration-300 z-50 flex flex-col ${
          isOpen ? "opacity-100 translate-y-0 h-[500px] pointer-events-auto" : "opacity-0 translate-y-10 h-0 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">LaporBot AI</h4>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-blue-100 text-[10px] uppercase tracking-widest font-bold">Online</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-blue-500/20 scrollbar-track-transparent">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-sm' 
                : 'bg-white/5 border border-white/10 text-slate-200 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center h-[44px]">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-black/40 border-t border-white/10">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Tanya sesuatu..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white disabled:opacity-50 transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:scale-110 transition-transform duration-300 flex items-center justify-center z-50 group ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <span className="text-2xl group-hover:animate-bounce">🤖</span>
      </button>
    </>
  );
}
