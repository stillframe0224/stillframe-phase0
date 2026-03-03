#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="public/models"
MODEL_FILE="$MODEL_DIR/depth-anything-v2-small-q4.onnx"
MODEL_URL="https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_q4f16.onnx"

mkdir -p "$MODEL_DIR"

if [ -f "$MODEL_FILE" ]; then
  echo "Model already exists: $MODEL_FILE"
  exit 0
fi

echo "Downloading Depth Anything V2 Small (q4, ~18MB)..."
curl -L -o "$MODEL_FILE" "$MODEL_URL"
echo "Downloaded to: $MODEL_FILE"
ls -lh "$MODEL_FILE"
