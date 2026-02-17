#!/usr/bin/env bash
set +e

IMAC_SOUND="${IMAC_SOUND:-1}"
IMAC_SOUND_SUCCESS="${IMAC_SOUND_SUCCESS:-/System/Library/Sounds/Glass.aiff}"
IMAC_SOUND_FAILURE="${IMAC_SOUND_FAILURE:-/System/Library/Sounds/Basso.aiff}"
IMAC_SOUND_ATTENTION="${IMAC_SOUND_ATTENTION:-/System/Library/Sounds/Submarine.aiff}"

_local_sound_play() {
  local file="$1"
  local repeat="$2"

  if [ "${IMAC_SOUND}" = "0" ]; then
    return 0
  fi

  if [ "$(uname -s 2>/dev/null || true)" != "Darwin" ]; then
    return 0
  fi

  local i=0
  while [ "$i" -lt "$repeat" ]; do
    afplay "$file" >/dev/null 2>&1 || true
    i=$((i + 1))
  done

  return 0
}

local_sound_success() {
  _local_sound_play "$IMAC_SOUND_SUCCESS" 1
}

local_sound_failure() {
  _local_sound_play "$IMAC_SOUND_FAILURE" 2
}

local_sound_attention() {
  _local_sound_play "$IMAC_SOUND_ATTENTION" 3
}
