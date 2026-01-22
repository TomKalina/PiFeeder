export interface StatusResponse {
  isStreaming: boolean;
  uptime: number;
  camera: {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    segmentDuration: number;
  };
}

const API_BASE = "/api";

export async function getStatus(): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE}/status`);
  if (!response.ok) {
    throw new Error("Failed to get status");
  }
  return response.json();
}

export async function startStream(): Promise<void> {
  const response = await fetch(`${API_BASE}/start`, { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to start stream");
  }
}

export async function stopStream(): Promise<void> {
  const response = await fetch(`${API_BASE}/stop`, { method: "POST" });
  if (!response.ok) {
    throw new Error("Failed to stop stream");
  }
}
