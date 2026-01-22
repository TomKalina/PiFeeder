STREAM_DIR=${STREAM_DIR:-./stream}
WIDTH=${CAMERA_WIDTH:-1280}
HEIGHT=${CAMERA_HEIGHT:-720}
FPS=${CAMERA_FPS:-15}
BITRATE=${CAMERA_BITRATE:-2000000}
SEGMENT=${HLS_SEGMENT_DURATION:-2}

mkdir -p "$STREAM_DIR"

rpicam-vid -t 0 --inline --width "$WIDTH" --height "$HEIGHT" \
  --framerate "$FPS" --bitrate "$BITRATE" --codec h264 -o - | \
  ffmpeg -i - -c:v copy -f hls -hls_time "$SEGMENT" -hls_list_size 3 \
  -hls_flags delete_segments+append_list "$STREAM_DIR/index.m3u8"
