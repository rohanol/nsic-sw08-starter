export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_PROXY_BYTES = 4 * 1024 * 1024;

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.setHeader("Allow", "POST, OPTIONS");
    response.end();
    return;
  }
  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Allow", "POST, OPTIONS");
    response.end();
    return;
  }

  const backendBaseUrl = (process.env.RENDER_API_BASE_URL ?? "").replace(/\/$/, "");
  const missionControlKey = process.env.MISSION_CONTROL_KEY ?? "";
  if (!backendBaseUrl || !missionControlKey) {
    sendJson(response, 503, { detail: "The secure analysis proxy is not configured." });
    return;
  }

  const chunks = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_PROXY_BYTES) {
      sendJson(response, 413, { detail: "This public deployment accepts image uploads up to 4 MB." });
      return;
    }
    chunks.push(chunk);
  }

  try {
    const upstream = await fetch(`${backendBaseUrl}/api/v1/assessments`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers["content-type"] ?? "application/octet-stream",
        "X-Mission-Control-Key": missionControlKey,
      },
      body: Buffer.concat(chunks),
    });
    const upstreamBody = Buffer.from(await upstream.arrayBuffer());
    response.statusCode = upstream.status;
    response.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
    const processTime = upstream.headers.get("x-process-time-ms");
    if (processTime) response.setHeader("X-Process-Time-Ms", processTime);
    response.end(upstreamBody);
  } catch {
    sendJson(response, 502, { detail: "The terrain analysis service could not be reached." });
  }
}
