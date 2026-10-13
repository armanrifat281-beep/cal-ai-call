#!/usr/bin/env bash
# Puts a Google AI Studio (Gemini) key into Supabase's secrets.
#
# The analysis function picks its provider from whichever key is set, so
# this is all that is needed to switch it to Gemini. Anthropic wins if both
# are present.
#
# The key is read with `read -s`: not echoed, not left in shell history.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Gemini key টা paste করো, তারপর Enter."
echo "(পর্দায় দেখা যাবে না - স্বাভাবিক)"
echo
printf 'Key: '
read -r -s key
echo

key="$(printf '%s' "$key" | tr -d '[:space:]')"
[[ -n $key ]] || { echo "❌ কিছুই দাওনি।"; exit 1; }

# Google issues both the older AIza keys and the newer AQ. ones.
if [[ ! $key =~ ^(AIza|AQ\.) ]]; then
  echo "❌ এটা Google-এর key বলে মনে হচ্ছে না."
  echo "   Google key শুরু হয় 'AIza' বা 'AQ.' দিয়ে; তোমারটা '${key:0:5}...' দিয়ে।"
  exit 1
fi

echo "চাবি পাওয়া গেছে (${#key} অক্ষর)। Supabase-এ পাঠাচ্ছি…"
npx supabase secrets set "GEMINI_API_KEY=$key" > /dev/null

echo "✅ বসেছে। এখন Claude-কে বলো - সে পরীক্ষা করে দেখাবে।"
