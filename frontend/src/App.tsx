import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { getStatus, startStream, stopStream, StatusResponse } from "./api";

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await getStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (status?.isStreaming) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource("/stream/index.m3u8");
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = "/stream/index.m3u8";
      }
    } else {
      video.removeAttribute("src");
      video.load();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [status?.isStreaming]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startStream();
      await fetchStatus();
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await stopStream();
      await fetchStatus();
    } finally {
      setStopping(false);
    }
  };

  const resolution = status
    ? `${status.camera.width}x${status.camera.height}`
    : "-";

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">PiFeeder</h1>
      </header>

      <main className="main">
        <div className="status-card">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              <div className="status-item">
                <span className="status-label">Status</span>
                <span
                  className={`status-value ${
                    status?.isStreaming ? "running" : "stopped"
                  }`}
                >
                  {status?.isStreaming ? "Running" : "Stopped"}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Resolution</span>
                <span className="status-value">{resolution}</span>
              </div>
              <div className="status-item">
                <span className="status-label">FPS</span>
                <span className="status-value">
                  {status ? status.camera.fps : "-"}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="video-container">
          {status?.isStreaming ? (
            <video ref={videoRef} className="video" autoPlay muted playsInline />
          ) : (
            <div className="video-placeholder">Stream not available</div>
          )}
        </div>

        <div className="controls">
          <button
            className="button button-start"
            onClick={handleStart}
            disabled={status?.isStreaming || starting}
          >
            {starting ? "Starting..." : "Start Stream"}
          </button>
          <button
            className="button button-stop"
            onClick={handleStop}
            disabled={!status?.isStreaming || stopping}
          >
            {stopping ? "Stopping..." : "Stop Stream"}
          </button>
        </div>
      </main>
    </div>
  );
}
