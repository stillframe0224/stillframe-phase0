#!/usr/bin/env bash
# OpenAI Image Probe runner - works without OPENAI_API_KEY (graceful skip)
set -euo pipefail
python3 "$(dirname "$0")/openai_image_probe.py" "$@"
