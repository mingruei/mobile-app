#!/bin/sh
set -e

if [ "${CONFIGURATION}" != "Release" ]; then
  exit 0
fi

EMBEDDED_HERMES_BIN="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermes.framework/hermes"

if [ -f "$EMBEDDED_HERMES_BIN" ]; then
  HERMES_BIN="$EMBEDDED_HERMES_BIN"
else
  HERMES_BIN="$(find "${PODS_ROOT}/hermes-engine" -path "*hermes.framework/hermes" -type f 2>/dev/null | head -n 1)"
fi

DSYM_OUTPUT="${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM"

if [ -z "$HERMES_BIN" ] || [ ! -f "$HERMES_BIN" ]; then
  echo "Hermes binary not found, skipping dSYM generation"
  exit 0
fi

if [ ! -d "$DSYM_OUTPUT" ]; then
  echo "Generating Hermes dSYM from ${HERMES_BIN}"
  dsymutil "$HERMES_BIN" -o "$DSYM_OUTPUT"
fi
