#!/usr/bin/env zsh
set -euo pipefail

# Disposable muted-CGA converter for blog excerpt screenshots.
#
# From inside excerpts/:
#   ./cga-muted.sh name.png
#   ./cga-muted.sh *.png
#   ./cga-muted.sh 2x name.png
#   ./cga-muted.sh 1x *.png
#
# Default checker size is 4x.

magick_bin="/opt/homebrew/bin/magick"
checker="4"

if [[ "$#" -eq 0 ]]; then
  echo "Usage: ./cga-muted.sh [1x|2x|4x] image.png [...]" >&2
  exit 1
fi

case "$1" in
  1x|2x|4x)
    checker="${1%x}"
    shift
    ;;
esac

if [[ "$#" -eq 0 ]]; then
  echo "Usage: ./cga-muted.sh [1x|2x|4x] image.png [...]" >&2
  exit 1
fi

palette="$(mktemp -t cga-muted-palette).png"
trap 'rm -f "$palette"' EXIT

"$magick_bin" \
  -size 4x1 xc:'#000000' \
  -fill '#00AAAA' -draw 'point 1,0' \
  -fill '#AA00AA' -draw 'point 2,0' \
  -fill '#AAAAAA' -draw 'point 3,0' \
  "$palette"

for input in "$@"; do
  if [[ "$input" == *-cga*.png ]]; then
    echo "Skipping generated file: $input"
    continue
  fi

  width="$("$magick_bin" identify -format '%w' "$input")"
  height="$("$magick_bin" identify -format '%h' "$input")"
  stem="${input:r}"

  if [[ "$checker" == "1" ]]; then
    output="${stem}-cga.png"
    "$magick_bin" "$input" \
      -background black -alpha remove -alpha off \
      -ordered-dither checks,2,2,2 \
      -remap "$palette" \
      "$output"
  else
    output="${stem}-cga-checker-${checker}x.png"
    "$magick_bin" "$input" \
      -background black -alpha remove -alpha off \
      -resize "$((100 / checker))%" \
      -ordered-dither checks,2,2,2 \
      -remap "$palette" \
      -filter point -resize "${width}x${height}!" \
      "$output"
  fi

  echo "$input -> $output"
done
