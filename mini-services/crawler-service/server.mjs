import { createServer } from "http";
import { spawn } from "child_process";

const PORT = 3003;

const server = createServer(async (req, res) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === "GET" && new URL(req.url, `http://localhost:${PORT}`).pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ status: "ok", port: PORT }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // Read body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  if (body.length > 10 * 1024 * 1024) {
    res.writeHead(413, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ error: "Body too large" }));
    return;
  }

  try {
    const parsed = JSON.parse(body);
    if (!parsed.urls || !Array.isArray(parsed.urls)) {
      res.writeHead(400, { "Content-Type": "application/json", ...corsHeaders });
      res.end(JSON.stringify({ error: "Include non-empty urls array" }));
      return;
    }
  } catch {
    res.writeHead(400, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  // Spawn bun process to run the actual crawler
  console.log(`[Server] Spawning crawler for request`);
  const crawler = spawn("bun", ["run", "index.ts"], {
    cwd: import.meta.dirname,
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  crawler.stdin.write(body);
  crawler.stdin.end();

  let stdout = "";
  let stderr = "";
  crawler.stdout.on("data", (d) => { stdout += d.toString(); });
  crawler.stderr.on("data", (d) => { stderr += d.toString(); });

  const timeout = setTimeout(() => {
    crawler.kill("SIGKILL");
    console.error("[Server] Crawler timeout");
  }, 300000);

  try {
    const exitCode = await new Promise((resolve, reject) => {
      crawler.on("close", resolve);
      crawler.on("error", reject);
    });
    clearTimeout(timeout);

    if (stderr) console.error("[Server] Crawler stderr:", stderr.substring(0, 500));
    
    let result;
    try {
      result = JSON.parse(stdout);
    } catch {
      res.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
      res.end(JSON.stringify({ error: "Failed to parse crawler output", stderr: stderr.substring(0, 500) }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify(result));
  } catch (err) {
    clearTimeout(timeout);
    console.error("[Server] Crawler error:", err);
    res.writeHead(500, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ error: "Crawler process failed" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] HTTP server running on port ${PORT}`);
});

process.stdin.resume();
process.on("uncaughtException", (e) => console.error("[Server] Uncaught:", e));
