import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import * as pdf from "pdf-parse";
const pdfParser = (pdf as any).default || pdf;
import { pipeline } from "@huggingface/transformers";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const upload = multer({ dest: "uploads/" });

  app.use(express.json());

  // In-memory storage for PDF context
  let chunks: string[] = [];
  let fullText = "";
  let generator: any = null;
  let extractor: any = null;

  // Lazy load models
  async function getGenerator() {
    if (!generator) {
      console.log("Loading DistilGPT2 model...");
      generator = await pipeline("text-generation", "Xenova/distilgpt2");
      console.log("Model loaded.");
    }
    return generator;
  }

  async function getExtractor() {
    if (!extractor) {
      console.log("Loading embedding model...");
      extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      console.log("Embedding model loaded.");
    }
    return extractor;
  }

  // Simple cosine similarity
  function cosineSimilarity(vecA: number[], vecB: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // API Routes
  app.post("/api/upload", upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const dataBuffer = fs.readFileSync(req.file.path);
      const data = await pdfParser(dataBuffer);
      fullText = data.text;

      // Simple chunking
      chunks = [];
      const words = fullText.split(/\s+/);
      for (let i = 0; i < words.length; i += 200) {
        chunks.push(words.slice(i, i + 250).join(" "));
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({ message: "PDF processed successfully", pageCount: data.numpages });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process PDF" });
    }
  });

  app.post("/api/summarize", async (req, res) => {
    try {
      if (!fullText) return res.status(400).json({ error: "No PDF uploaded yet" });

      const gen = await getGenerator();
      const prompt = `Summarize the following text briefly:\n\n${fullText.substring(0, 1500)}...`;
      
      const output = await gen(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        do_sample: true,
      });

      const summary = output[0].generated_text.replace(prompt, "").trim();
      res.json({ summary });
    } catch (error) {
      console.error("Summarize error:", error);
      res.status(500).json({ error: "Failed to summarize" });
    }
  });

  app.post("/api/ask", async (req, res) => {
    try {
      const { question } = req.body;
      if (chunks.length === 0) return res.status(400).json({ error: "No PDF uploaded yet" });

      const embed = await getExtractor();
      const questionEmbedding = await embed(question, { pooling: "mean", normalize: true });
      const qVec = Array.from(questionEmbedding.data as Float32Array);

      // Find top 3 chunks
      const scoredChunks = await Promise.all(chunks.map(async (chunk) => {
        const chunkEmbedding = await embed(chunk, { pooling: "mean", normalize: true });
        const cVec = Array.from(chunkEmbedding.data as Float32Array);
        return { chunk, score: cosineSimilarity(qVec, cVec) };
      }));

      const topChunks = scoredChunks.sort((a, b) => b.score - a.score).slice(0, 3);
      const context = topChunks.map(c => c.chunk).join("\n\n");

      const gen = await getGenerator();
      const prompt = `Answer the question based ONLY on the context provided. If the answer is not in the context, say "I don't know".\n\nContext: ${context.substring(0, 1000)}\n\nQuestion: ${question}\n\nAnswer:`;
      
      const output = await gen(prompt, {
        max_new_tokens: 100,
        temperature: 0.3,
        do_sample: true,
      });

      const answer = output[0].generated_text.replace(prompt, "").trim();
      res.json({ answer });
    } catch (error) {
      console.error("Ask error:", error);
      res.status(500).json({ error: "Failed to answer question" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
