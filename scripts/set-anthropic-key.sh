#!/usr/bin/env bash
# Puts the Anthropic key into Supabase's secrets.
#
# It asks for the key rather than reading the clipboard. The clipboard
# approach kept failing for a reason that had nothing to do with the key:
# every time the script printed an error, that error got copied to send on,
# which replaced the key. Asking is immune to that.
#
# The key is read with `read -s`, so it is not echoed to the screen and does
# not land in the shell's history.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Anthropic key টা এখানে paste করো, তারপর Enter চাপো."
echo "(লেখাটা পর্দায় দেখা যাবে না - এটা স্বাভাবিক, নিরাপত্তার জন্য)"
echo
printf 'Key: '
read -r -s key
echo

key="$(printf '%s' "$key" | tr -d '[:space:]')"

if [[ -z $key ]]; then
  echo "❌ কিছুই দাওনি। আবার চালাও।"
  exit 1
fi

if [[ ! $key =~ ^sk-ant- ]]; then
  echo "❌ এটা Anthropic key বলে মনে হচ্ছে না."
  echo "   Anthropic key শুরু হয় 'sk-ant-' দিয়ে; তোমারটা শুরু হয়েছে '${key:0:6}...' দিয়ে।"
  echo "   ভুল কিছু paste হয়েছে কি না দেখো।"
  exit 1
fi

echo "চাবি পাওয়া গেছে (${#key} অক্ষর)। Supabase-এ পাঠাচ্ছি…"
npx supabase secrets set "ANTHROPIC_API_KEY=$key" > /dev/null

echo "✅ বসেছে। এখন Claude-কে বলো - সে পরীক্ষা করে দেখাবে।"
