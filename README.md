# PiFeeder

A lightweight camera streaming solution for Raspberry Pi Zero W 2 with Camera Module V3, built with Deno (backend) and React (frontend). Stream your camera footage over Wi-Fi within your local network.

## Features

- **Live Camera Streaming**: Real-time video streaming from Raspberry Pi Camera Module V3
- **HLS Protocol**: Reliable HTTP Live Streaming via HLS (m3u8 + .ts segments)
- **Local Network Access**: Access the stream via Wi-Fi (LAN) - no cloud or internet required
- **Web Dashboard**: React-based frontend with video player and camera status
- **Simple Setup**: Minimal dependencies, easy configuration
- **Resource Optimized**: Designed to run efficiently on Raspberry Pi Zero W 2

## Hardware Requirements

- Raspberry Pi Zero W 2
- Raspberry Pi Camera Module V3
- MicroSD card (16GB+ recommended)
- Stable Wi-Fi connection

## Software Requirements

- Raspberry Pi OS (Bookworm or later)
- Deno 2.x
- Node.js 20+ (for React development)
- `libcamera-apps` (install via `sudo apt install libcamera-apps`)
- `ffmpeg`

## Architecture

```
Camera Module V3
    ↓
libcamera-vid (capture)
    ↓
ffmpeg (encoding → HLS)
    ↓
HLS Segments (m3u8 + .ts files)
    ↓
Deno Server (static files + API)
    ↓
React Frontend (video player + controls)
    ↓
Browser (Wi-Fi LAN access)
```

### Components

**Backend (Deno)**
- Static file server for HLS segments
- REST API for camera status and control
- Process management for stream lifecycle

**Frontend (React)**
- HLS video player (via `hls.js`)
- Camera status display
- Stream start/stop controls

**Streaming Pipeline**
- `libcamera-vid` captures video from Camera V3
- `ffmpeg` encodes to H.264 and generates HLS segments
- Segments served via Deno HTTP server
- React client plays HLS stream in browser

## Installation

### 1. System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install libcamera-apps (contains libcamera-vid)
sudo apt install libcamera-apps -y

# Install ffmpeg
sudo apt install ffmpeg -y

# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Add Deno to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.deno/bin:$PATH"
```

### 2. Project Setup

```bash
# Clone repository
git clone https://github.com/TomKalina/PiFeeder.git
cd PiFeeder

# Install backend dependencies (managed via Deno)
# No install step needed - dependencies imported via URL

# Install frontend dependencies
cd frontend
npm install
cd ..
```

## Configuration

### Backend Configuration

Create `.env` file in project root:

```env
# Server
PORT=8080
HOST=0.0.0.0

# Streaming
STREAM_DIR=./stream
HLS_SEGMENT_DURATION=2
HLS_PLAYLIST_TYPE=live

# Camera
CAMERA_WIDTH=1280
CAMERA_HEIGHT=720
CAMERA_FPS=15
CAMERA_BITRATE=2000000

# FFmpeg
FFMPEG_PRESET=ultrafast
```

### Camera Setup

Test camera with `libcamera-vid`:

```bash
libcamera-vid -t 0 --inline --inline-headers
```

## Usage

### Starting the Stream (Manual)

```bash
# Start HLS stream generation
ffmpeg -f v4l2 -input_format h264 -video_size 1280x720 -framerate 15 \
  -i /dev/video0 -c:v copy -hls_time 2 -hls_list_size 3 \
  -hls_flags delete_segments+append_list ./stream/index.m3u8
```

### Starting the Backend

```bash
# Development mode (with auto-reload)
deno run --watch --allow-net --allow-read --allow-write backend/server.ts

# Production mode
deno run --allow-net --allow-read --allow-write backend/server.ts
```

### Starting the Frontend

```bash
cd frontend

# Development mode
npm run dev

# Production build
npm run build
# Then serve the build directory (e.g., with Deno)
deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts dist
```

### Access the Stream

1. Connect to the same Wi-Fi network as your Raspberry Pi
2. Open browser and navigate to:
   - `http://raspberrypi.local:3000` (if mDNS is enabled)
   - `http://<PI_IP_ADDRESS>:3000` (e.g., `http://192.168.1.50:3000`)

## API Endpoints

### GET `/stream/index.m3u8`
Returns the HLS playlist file.

### GET `/stream/*.ts`
Returns video segment files.

### GET `/api/status`
Returns current streaming status:
```json
{
  "isStreaming": true,
  "uptime": 3600,
  "camera": {
    "width": 1280,
    "height": 720,
    "fps": 15
  }
}
```

### POST `/api/start`
Starts the camera stream process.

### POST `/api/stop`
Stops the camera stream process.

## Performance Tuning

### Recommended Settings for Pi Zero W 2

- **Resolution**: 720p (1280x720) or 480p (640x480)
- **FPS**: 15-25
- **Bitrate**: 1.5-2.5 Mbps
- **HLS Segment Duration**: 2-3 seconds
- **Playlist Size**: 3-5 segments

### CPU Usage Reduction

```env
# Lower resolution
CAMERA_WIDTH=640
CAMERA_HEIGHT=480

# Lower FPS
CAMERA_FPS=15

# Use hardware encoding (if supported)
FFMPEG_HWACCEL=h264_omx
```

## Troubleshooting

### Camera Not Detected

```bash
# Check if camera is recognized
libcamera-hello

# Check video device
ls -l /dev/video*
```

### Permission Denied on /dev/video0

```bash
# Add user to video group
sudo usermod -a -G video $USER
# Reboot required
sudo reboot
```

### Stream Not Loading in Browser

- Check if HLS files are being generated in `./stream/` directory
- Verify backend is serving static files correctly
- Check browser console for CORS errors
- Ensure `hls.js` is properly loaded in React app

### High CPU Usage

- Lower resolution and FPS
- Reduce HLS segment size
- Ensure hardware encoding is used
- Check for background processes

## Security Considerations

- **Local Access Only**: This setup is designed for LAN access only
- **No Authentication**: By default, no password protection
- **Network Segmentation**: Consider IoT VLAN for camera devices
- **HTTPS**: For production, add HTTPS with self-signed or Let's Encrypt certs

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
