import crypto from "node:crypto";
import { createRequire } from "node:module";
import http from "node:http";
import { analyzeTerrain } from "../analysis-tools/dist/index.js";
import { analyzeVisualComplexity } from "../analysis-tools/dist/modules/vision.js";

const modelRequire = createRequire(new URL("../analysis-tools/package.json", import.meta.url));
const sharp = modelRequire("sharp");
const port = Number(process.env.PORT ?? 8090);
const maxPayloadBytes = 14 * 1024 * 1024;

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function serialize(value) {
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialize(child)]));
  }
  return value;
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxPayloadBytes) throw new Error("Request payload exceeds the analysis-service limit.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function runVisualOnly({ filename, image, options }) {
  const sourcePng = await sharp(image).rotate().removeAlpha().png().toBuffer();
  const metadata = await sharp(sourcePng).metadata();
  if (!metadata.width || !metadata.height) throw new Error("The uploaded image has no dimensions.");
  const visualComplexity = await analyzeVisualComplexity(sourcePng, options ?? { columns: 6, rows: 4 });
  return {
    analysisId: crypto.randomUUID(),
    source: { filename, width: metadata.width, height: metadata.height, png: sourcePng },
    visualComplexity,
    limitations: [
      "The Mars-trained semantic model was intentionally skipped because this image was not verified for Mars-model use.",
      "Visual-complexity scores measure local image edges, texture, and contrast only; they do not prove an area is dangerous or safe.",
    ],
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return sendJson(response, 200, { status: "ok", service: "analysis-tools-sidecar" });
  }

  if (request.method !== "POST" || request.url !== "/analyze") {
    return sendJson(response, 404, { detail: "Not found" });
  }

  try {
    const payload = await readJson(request);
    const filename = String(payload.filename ?? "").trim();
    const image = Buffer.from(String(payload.imageBase64 ?? ""), "base64");
    const mode = payload.mode === "visual-only" ? "visual-only" : "full";
    if (!filename || !image.length) return sendJson(response, 422, { detail: "filename and imageBase64 are required." });
    const result = mode === "full"
      ? await analyzeTerrain({ filename, image, options: payload.options })
      : await runVisualOnly({ filename, image, options: payload.options });
    return sendJson(response, 200, serialize(result));
  } catch (error) {
    return sendJson(response, 500, { detail: error instanceof Error ? error.message : "Independent terrain analysis failed." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`analysis-tools sidecar listening on ${port}`);
});
