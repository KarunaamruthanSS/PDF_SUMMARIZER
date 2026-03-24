import express from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import * as pdf from "pdf-parse";
import { pipeline } from "@huggingface/transformers";

const pdfParser = (pdf as any).default || pdf;

type EmbeddingVector = number[];

interface SourceSnippet {
  chunk: string;
  score: number;
}

interface DocumentContext {
  id: string;
  name: string;
  uploadedAt: string;
  fullText: string;
  chunks: string[];
  embeddings: EmbeddingVector[];
}

interface RequestMetrics {
  requestCount: number;
  statusCounts: Record<string, number>;
  endpointCount: Record<string, number>;
  totalLatencyMs: number;
  averageLatencyMs: number;
}

interface AppDependencies {
  getGenerator: () => Promise<any>;
  getExtractor: () => Promise<any>;
  embedText: (text: string) => Promise<EmbeddingVector>;
  generateText: (prompt: string, options: Record<string, unknown>) => Promise<string>;
}

const PORT = Number(process.env.PORT || 3000);
const MOCK_AI = process.env.MOCK_AI === "true";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const documents = new Map<string, DocumentContext>();
const metrics: RequestMetrics = {
  requestCount: 0,
  statusCounts: {},
  endpointCount: {},
  totalLatencyMs: 0,
  averageLatencyMs: 0,
};

let generator: any = null;
let extractor: any = null;

function chunkText(fullText: string): string[] {
  const words = fullText.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 200) {
    chunks.push(words.slice(i, i + 250).join(" "));
  }
  return chunks;
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const size = Math.min(vecA.length, vecB.length);

  for (let i = 0; i < size; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getGenerator() {
  if (MOCK_AI) {
    return null;
  }

  if (!generator) {
    console.log(JSON.stringify({ event: "model_load_start", model: "Xenova/distilgpt2" }));
    generator = await pipeline("text-generation", "Xenova/distilgpt2");
    console.log(JSON.stringify({ event: "model_load_complete", model: "Xenova/distilgpt2" }));
  }

  return generator;
}

async function getExtractor() {
  if (MOCK_AI) {
    return null;
  }

  if (!extractor) {
    console.log(JSON.stringify({ event: "model_load_start", model: "Xenova/all-MiniLM-L6-v2" }));
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log(JSON.stringify({ event: "model_load_complete", model: "Xenova/all-MiniLM-L6-v2" }));
  }

  return extractor;
}

function mockEmbedding(text: string, width = 32): EmbeddingVector {
  const vector = new Array(width).fill(0);
  for (let i = 0; i < text.length; i++) {
    vector[i % width] += text.charCodeAt(i) / 255;
  }
  return vector;
}

async function embedText(text: string): Promise<EmbeddingVector> {
  if (MOCK_AI) {
    return mockEmbedding(text);
  }

  const embedder = await getExtractor();
  const embedding = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(embedding.data as Float32Array);
}

async function generateText(prompt: string, options: Record<string, unknown>): Promise<string> {
  if (MOCK_AI) {
    return `MOCK_RESPONSE: ${prompt.slice(0, 160)}`;
  }

  const textGenerator = await getGenerator();
  const output = await textGenerator(prompt, options);
  return output[0].generated_text.replace(prompt, "").trim();
}

function createDependencies(): AppDependencies {
  return {
    getGenerator,
    getExtractor,
    embedText,
    generateText,
  };
}

export function createApp(deps: AppDependencies = createDependencies()) {
  const app = express();

  app.use(express.json({ limit: "2mb" }));

  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const latency = Date.now() - start;
      metrics.requestCount += 1;
      metrics.totalLatencyMs += latency;
      metrics.averageLatencyMs = Number((metrics.totalLatencyMs / metrics.requestCount).toFixed(2));

      const statusKey = String(res.statusCode);
      metrics.statusCounts[statusKey] = (metrics.statusCounts[statusKey] || 0) + 1;
      metrics.endpointCount[req.path] = (metrics.endpointCount[req.path] || 0) + 1;

      console.log(
        JSON.stringify({
          event: "http_request",
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          latencyMs: latency,
          requestCount: metrics.requestCount,
        }),
      );
    });

    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, documentCount: documents.size, mockAi: MOCK_AI });
  });

  app.get("/api/metrics", (_req, res) => {
    res.json(metrics);
  });

  app.post("/api/upload", upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const parsed = await pdfParser(req.file.buffer);
      const fullText = String(parsed.text || "").trim();
      if (!fullText) {
        return res.status(400).json({ error: "Uploaded PDF has no extractable text" });
      }

      const chunks = chunkText(fullText);
      const embeddings = await Promise.all(chunks.map((chunk) => deps.embedText(chunk)));
      const documentId = randomUUID();

      const context: DocumentContext = {
        id: documentId,
        name: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        fullText,
        chunks,
        embeddings,
      };

      documents.set(documentId, context);

      return res.json({
        message: "PDF processed successfully",
        pageCount: parsed.numpages,
        docId: documentId,
        chunkCount: chunks.length,
      });
    } catch (error) {
      console.error(JSON.stringify({ event: "upload_error", error }));
      return res.status(500).json({ error: "Failed to process PDF" });
    }
  });

  app.post("/api/upload-text", async (req, res) => {
    if (!MOCK_AI) {
      return res.status(404).json({ error: "Not available" });
    }

    try {
      const { text, name } = req.body || {};
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }

      const chunks = chunkText(text);
      const embeddings = await Promise.all(chunks.map((chunk) => deps.embedText(chunk)));
      const documentId = randomUUID();

      documents.set(documentId, {
        id: documentId,
        name: name || "mock-document.txt",
        uploadedAt: new Date().toISOString(),
        fullText: text,
        chunks,
        embeddings,
      });

      return res.json({ message: "Text processed", docId: documentId, chunkCount: chunks.length });
    } catch (error) {
      console.error(JSON.stringify({ event: "upload_text_error", error }));
      return res.status(500).json({ error: "Failed to process text" });
    }
  });

  app.post("/api/summarize", async (req, res) => {
    try {
      const { docId } = req.body || {};
      if (!docId || typeof docId !== "string") {
        return res.status(400).json({ error: "docId is required" });
      }

      const context = documents.get(docId);
      if (!context) {
        return res.status(404).json({ error: "Document not found" });
      }

      const prompt = `Summarize the following text briefly:\n\n${context.fullText.substring(0, 1500)}...`;
      const summary = await deps.generateText(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        do_sample: true,
      });

      return res.json({ summary });
    } catch (error) {
      console.error(JSON.stringify({ event: "summarize_error", error }));
      return res.status(500).json({ error: "Failed to summarize" });
    }
  });

  app.post("/api/ask", async (req, res) => {
    try {
      const { docId, question } = req.body || {};

      if (!docId || typeof docId !== "string") {
        return res.status(400).json({ error: "docId is required" });
      }
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question is required" });
      }

      const context = documents.get(docId);
      if (!context) {
        return res.status(404).json({ error: "Document not found" });
      }

      const questionEmbedding = await deps.embedText(question);
      const scoredChunks = context.chunks.map((chunk, index) => ({
        chunk,
        score: cosineSimilarity(questionEmbedding, context.embeddings[index]),
      }));

      const topChunks = scoredChunks.sort((a, b) => b.score - a.score).slice(0, 3);
      const topSources: SourceSnippet[] = topChunks.map(({ chunk, score }) => ({
        chunk,
        score: Number(score.toFixed(4)),
      }));
      const contextText = topChunks.map((item) => item.chunk).join("\n\n");

      const prompt = `Answer the question based ONLY on the context provided. If the answer is not in the context, say "I don't know".\n\nContext: ${contextText.substring(0, 1000)}\n\nQuestion: ${question}\n\nAnswer:`;
      const answer = await deps.generateText(prompt, {
        max_new_tokens: 100,
        temperature: 0.3,
        do_sample: true,
      });

      return res.json({ answer, sources: topSources });
    } catch (error) {
      console.error(JSON.stringify({ event: "ask_error", error }));
      return res.status(500).json({ error: "Failed to answer question" });
    }
  });

  return app;
}

export async function startServer() {
  const app = createApp();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(JSON.stringify({ event: "server_start", url: `http://localhost:${PORT}`, mockAi: MOCK_AI }));
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error(JSON.stringify({ event: "server_fatal", error }));
    process.exit(1);
  });
}
