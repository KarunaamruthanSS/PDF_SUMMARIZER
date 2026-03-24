async function run() {
  process.env.MOCK_AI = "true";
  process.env.NODE_ENV = "test";

  const { createApp } = await import("../server.ts");
  const app = createApp();

  const server = app.listen(0);

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not determine server address");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (!healthResponse.ok) {
      throw new Error("Health endpoint failed");
    }

    const uploadResponse = await fetch(`${baseUrl}/api/upload-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "smoke.txt",
        text: "PDF summarizer smoke test text. The context says Paris is the capital of France.",
      }),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload-text failed with ${uploadResponse.status}`);
    }

    const uploadJson = (await uploadResponse.json()) as { docId?: string };
    if (!uploadJson.docId) {
      throw new Error("Upload-text did not return docId");
    }

    const summarizeResponse = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: uploadJson.docId }),
    });
    if (!summarizeResponse.ok) {
      throw new Error(`Summarize failed with ${summarizeResponse.status}`);
    }

    const askResponse = await fetch(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docId: uploadJson.docId,
        question: "What is the capital of France?",
      }),
    });

    if (!askResponse.ok) {
      throw new Error(`Ask failed with ${askResponse.status}`);
    }

    const askJson = (await askResponse.json()) as { answer?: string; sources?: Array<unknown> };
    if (!askJson.answer || !askJson.sources || askJson.sources.length === 0) {
      throw new Error("Ask response missing answer or sources");
    }

    const metricsResponse = await fetch(`${baseUrl}/api/metrics`);
    if (!metricsResponse.ok) {
      throw new Error("Metrics endpoint failed");
    }

    console.log("TypeScript API smoke test passed");
  } finally {
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
