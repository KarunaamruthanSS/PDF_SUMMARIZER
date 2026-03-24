import React, { useState, useRef, useEffect } from "react";
import { Upload, FileText, Send, Trash2, Loader2, MessageSquare, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SourceSnippet {
  chunk: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceSnippet[];
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [summary, setSummary] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pdfInfo, setPdfInfo] = useState<{ name: string; pages: number; chunks: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || selectedFile.type !== "application/pdf") return;

    setFile(selectedFile);
    setSummary("");
    setMessages([]);
    setErrorMessage("");
    setIsUploading(true);

    const formData = new FormData();
    formData.append("pdf", selectedFile);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setDocId(data.docId);
        setPdfInfo({ name: selectedFile.name, pages: data.pageCount, chunks: data.chunkCount });
      } else {
        setDocId(null);
        setPdfInfo(null);
        setErrorMessage(data.error || "Upload failed.");
      }
    } catch (error) {
      console.error("Upload failed", error);
      setDocId(null);
      setPdfInfo(null);
      setErrorMessage("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSummarize = async () => {
    if (!docId) return;

    setErrorMessage("");
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Could not generate summary.");
        return;
      }
      setSummary(data.summary || "Could not generate summary.");
    } catch (error) {
      console.error("Summarization failed", error);
      setErrorMessage("Summarization failed. Please try again.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAsk = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isAsking || !docId) return;

    setErrorMessage("");
    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsAsking(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, question: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "I'm sorry, I couldn't process that request." },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "I'm sorry, I couldn't find an answer.",
          sources: data.sources,
        },
      ]);
    } catch (error) {
      console.error("QA failed", error);
      setErrorMessage("Question answering failed. Please try again.");
    } finally {
      setIsAsking(false);
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex h-screen bg-[#f0f2f6] font-sans text-[#31333F]">
      <div className="w-80 bg-[#f0f2f6] border-r border-[#d1d5db] p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="text-[#ff4b4b]" size={32} />
          <h1 className="text-2xl font-bold">PDF AI</h1>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-[#5f6368] uppercase tracking-wider mb-3">Upload PDF</h2>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#d1d5db] rounded-lg cursor-pointer hover:bg-white transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-2 text-[#5f6368]" />
              <p className="text-xs text-[#5f6368]">Click to upload or drag and drop</p>
            </div>
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
          </label>
          {isUploading && <p className="mt-2 text-xs text-[#5f6368]">Processing upload...</p>}
          {errorMessage && <p className="mt-2 text-xs text-[#b42318]">{errorMessage}</p>}
          {pdfInfo && (
            <div className="mt-3 p-3 bg-white rounded border border-[#d1d5db] flex items-center gap-2">
              <FileText size={16} className="text-[#ff4b4b]" />
              <div className="overflow-hidden">
                <p className="text-xs font-medium truncate">{pdfInfo.name}</p>
                <p className="text-[10px] text-[#5f6368]">{pdfInfo.pages} pages · {pdfInfo.chunks} chunks</p>
              </div>
            </div>
          )}
        </section>

        <section>
          <button
            onClick={handleSummarize}
            disabled={!docId || isSummarizing}
            className="w-full py-2 bg-[#ff4b4b] text-white rounded-md font-medium hover:bg-[#e63939] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSummarizing ? <Loader2 className="animate-spin" size={18} /> : "Summarize PDF"}
          </button>
        </section>

        <div className="mt-auto pt-6 border-t border-[#d1d5db]">
          <p className="text-[10px] text-[#5f6368] text-center italic">Powered by DistilGPT2 & Transformers.js</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <header className="px-8 py-4 border-bottom border-[#f0f2f6] flex justify-between items-center">
          <h2 className="text-xl font-semibold">Document Analysis</h2>
          <button
            onClick={clearChat}
            className="p-2 text-[#5f6368] hover:bg-[#f0f2f6] rounded-full transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          <AnimatePresence>
            {summary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#f8f9fb] p-6 rounded-xl border border-[#e0e0e0]"
              >
                <div className="flex items-center gap-2 mb-4 text-[#ff4b4b]">
                  <FileText size={20} />
                  <h3 className="font-bold uppercase text-sm tracking-widest">Summary</h3>
                </div>
                <p className="text-[#31333F] leading-relaxed whitespace-pre-wrap">{summary}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6 pb-24">
            {messages.length === 0 && !summary && (
              <div className="flex flex-col items-center justify-center h-64 text-[#5f6368] opacity-50">
                <MessageSquare size={48} className="mb-4" />
                <p>Upload a PDF and start asking questions!</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: msg.role === "user" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-[#ff4b4b] text-white rounded-tr-none"
                      : "bg-[#f0f2f6] text-[#31333F] rounded-tl-none"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 border-t border-[#d1d5db] pt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider">Top Retrieved Sources</p>
                      {msg.sources.map((source, sourceIndex) => (
                        <div key={`${i}-source-${sourceIndex}`} className="text-xs bg-white/70 p-2 rounded">
                          <p className="font-semibold">Score: {source.score}</p>
                          <p className="line-clamp-3">{source.chunk}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isAsking && (
              <div className="flex justify-start">
                <div className="bg-[#f0f2f6] p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <Loader2 className="animate-spin text-[#ff4b4b]" size={16} />
                  <span className="text-xs text-[#5f6368]">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </main>

        <div className="p-8 bg-white border-t border-[#f0f2f6]">
          <form onSubmit={handleAsk} className="relative max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={docId ? "Ask a question about the PDF..." : "Upload a PDF first..."}
              disabled={!docId || isAsking}
              className="w-full pl-6 pr-16 py-4 bg-[#f0f2f6] border-none rounded-2xl focus:ring-2 focus:ring-[#ff4b4b] outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!docId || isAsking || !input.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#ff4b4b] text-white rounded-xl hover:bg-[#e63939] disabled:opacity-50 transition-colors"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
