import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  extname,
  join,
  resolve,
} from "https://deno.land/std@0.208.0/path/mod.ts";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

const env = await load();
const PORT = parseInt(env.PORT || "8080");
const HOST = env.HOST || "0.0.0.0";
const STREAM_DIR = env.STREAM_DIR || "./stream";
const FRONTEND_DIR = env.FRONTEND_DIR || "./frontend/dist";
const AUTO_START_STREAM = env.AUTO_START_STREAM === "true";

let cameraProcess: Deno.ChildProcess | null = null;
let ffmpegProcess: Deno.ChildProcess | null = null;
let streamStartTime: number | null = null;

const cameraConfig = {
  width: parseInt(env.CAMERA_WIDTH || "1280"),
  height: parseInt(env.CAMERA_HEIGHT || "720"),
  fps: parseInt(env.CAMERA_FPS || "15"),
  bitrate: parseInt(env.CAMERA_BITRATE || "2000000"),
  segmentDuration: parseInt(env.HLS_SEGMENT_DURATION || "2"),
};

async function ensureStreamDir() {
  try {
    await Deno.mkdir(STREAM_DIR, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      console.error("Failed to create stream directory:", error);
    }
  }
}

function getContentType(pathname: string) {
  const ext = extname(pathname).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".m3u8": "application/vnd.apple.mpegurl",
    ".ts": "video/mp2t",
  };
  return types[ext] || "application/octet-stream";
}

async function readFileResponse(filePath: string, pathname: string) {
  const file = await Deno.readFile(filePath);
  return new Response(file, {
    headers: { ...corsHeaders, "Content-Type": getContentType(pathname) },
  });
}

async function logReadable(
  readable: ReadableStream<Uint8Array>,
  label: string
) {
  const reader = readable.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      console.error(label, decoder.decode(value));
    }
  }
}

async function startStream() {
  if (cameraProcess || ffmpegProcess) {
    return { success: false, error: "Stream is already running" };
  }

  try {
    await ensureStreamDir();

    const cameraArgs = [
      "-t",
      "0",
      "--inline",
      "--inline-headers",
      "--width",
      cameraConfig.width.toString(),
      "--height",
      cameraConfig.height.toString(),
      "--framerate",
      cameraConfig.fps.toString(),
      "--bitrate",
      cameraConfig.bitrate.toString(),
      "--codec",
      "h264",
      "-o",
      "-",
    ];

    const ffmpegArgs = [
      "-i",
      "-",
      "-c:v",
      "copy",
      "-f",
      "hls",
      "-hls_time",
      cameraConfig.segmentDuration.toString(),
      "-hls_list_size",
      "3",
      "-hls_flags",
      "delete_segments+append_list",
      join(STREAM_DIR, "index.m3u8"),
    ];

    cameraProcess = new Deno.Command("rpicam-vid", {
      args: cameraArgs,
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    ffmpegProcess = new Deno.Command("ffmpeg", {
      args: ffmpegArgs,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    if (cameraProcess.stderr) {
      logReadable(cameraProcess.stderr, "rpicam-vid");
    }

    if (ffmpegProcess.stderr) {
      logReadable(ffmpegProcess.stderr, "ffmpeg");
    }

    if (cameraProcess.stdout && ffmpegProcess.stdin) {
      cameraProcess.stdout.pipeTo(ffmpegProcess.stdin).catch(() => {});
    } else {
      cameraProcess.kill("SIGTERM");
      ffmpegProcess.kill("SIGTERM");
      cameraProcess = null;
      ffmpegProcess = null;
      return { success: false, error: "Failed to connect camera output" };
    }

    streamStartTime = Date.now();
    console.log("Stream started");
    return { success: true };
  } catch (error) {
    console.error("Failed to start stream:", error);
    cameraProcess?.kill("SIGTERM");
    ffmpegProcess?.kill("SIGTERM");
    cameraProcess = null;
    ffmpegProcess = null;
    return { success: false, error: error.message };
  }
}

async function stopStream() {
  if (!cameraProcess && !ffmpegProcess) {
    return { success: false, error: "No stream is running" };
  }

  try {
    cameraProcess?.kill("SIGTERM");
    ffmpegProcess?.kill("SIGTERM");
    cameraProcess = null;
    ffmpegProcess = null;
    streamStartTime = null;
    console.log("Stream stopped");
    return { success: true };
  } catch (error) {
    console.error("Failed to stop stream:", error);
    return { success: false, error: error.message };
  }
}

function getStreamStatus() {
  const uptime = streamStartTime
    ? Math.floor((Date.now() - streamStartTime) / 1000)
    : 0;

  return {
    isStreaming: cameraProcess !== null && ffmpegProcess !== null,
    uptime,
    camera: cameraConfig,
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    console.error("Method not allowed", req.method, url.pathname);
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (url.pathname === "/api/status") {
    if (req.method !== "GET") {
      console.error("Status method not allowed", req.method);
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify(getStreamStatus()), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/start") {
    if (req.method !== "POST") {
      console.error("Start method not allowed", req.method);
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }
    const result = await startStream();
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/api/stop") {
    if (req.method !== "POST") {
      console.error("Stop method not allowed", req.method);
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }
    const result = await stopStream();
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (url.pathname.startsWith("/stream/")) {
    const relativePath = url.pathname.replace("/stream/", "");
    const filePath = resolve(STREAM_DIR, relativePath);

    try {
      return await readFileResponse(filePath, url.pathname);
    } catch (error) {
      console.error("Stream file not found", url.pathname, error);
      return new Response("File not found", {
        status: 404,
        headers: corsHeaders,
      });
    }
  }

  if (url.pathname.startsWith("/api")) {
    console.error("API route not found", url.pathname);
    return new Response("Not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  try {
    const relativePath = url.pathname === "/"
      ? "index.html"
      : url.pathname.replace(/^\//, "");
    const filePath = resolve(FRONTEND_DIR, relativePath);
    const baseDir = resolve(FRONTEND_DIR);

    if (!filePath.startsWith(baseDir)) {
      console.error("Frontend path outside base", filePath);
      return new Response("Not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    return await readFileResponse(filePath, relativePath);
  } catch (error) {
    console.error("Frontend file not found", url.pathname, error);
    return new Response("Not found", {
      status: 404,
      headers: corsHeaders,
    });
  }
}

console.log(`Starting PiFeeder backend on http://${HOST}:${PORT}`);

if (AUTO_START_STREAM) {
  const result = await startStream();
  if (!result.success) {
    console.error(result.error);
  }
}

await serve(handler, {
  hostname: HOST,
  port: PORT,
});
