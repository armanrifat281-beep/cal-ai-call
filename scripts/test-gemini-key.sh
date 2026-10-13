#!/usr/bin/env bash
# Asks what a Google AI Studio key can actually reach, before any code is
# written against it.
#
# Model names go stale fast, so this lists what the key has access to rather
# than guessing, then calls the best vision-capable one. An earlier version
# guessed two names and got 404 twice - which still proved the key itself
# authenticates, but said nothing about what to build on.
#
# The key is read with `read -s`: not echoed, not left in shell history.
set -euo pipefail

echo "Google AI Studio (Gemini) key টা paste করো, তারপর Enter."
echo "(পর্দায় দেখা যাবে না - স্বাভাবিক)"
echo
printf 'Key: '
read -r -s key
echo

key="$(printf '%s' "$key" | tr -d '[:space:]')"
[[ -n $key ]] || { echo "❌ কিছুই দাওনি।"; exit 1; }

echo "কোন মডেলগুলো পাওয়া যায় দেখছি…"
code="$(curl -s -o /tmp/gemini-models.json -w '%{http_code}' \
  -H "x-goog-api-key: $key" \
  'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200' || echo 000)"

if [[ $code != 200 ]]; then
  echo "❌ মডেলের তালিকা আনা গেল না (HTTP $code)."
  python3 -c "
import json
try:
    d=json.load(open('/tmp/gemini-models.json'))
    print('   ', (d.get('error') or {}).get('message','')[:200])
except Exception: pass
" 2>/dev/null || true
  rm -f /tmp/gemini-models.json
  exit 1
fi

echo "✅ চাবি কাজ করছে - Google তালিকা দিয়েছে."
echo
python3 -c "
import json
d=json.load(open('/tmp/gemini-models.json'))
have={m['name'].removeprefix('models/') for m in d.get('models', [])
      if 'generateContent' in (m.get('supportedGenerationMethods') or [])}
# Stable models first, and no preview ones: a preview model has little or no
# free quota, which is how the first attempt at this came back 429 rather
# than with an answer.
order=['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.5-pro','gemini-3-flash-preview']
print(' '.join(m for m in order if m in have))
" > /tmp/gemini-order.txt

rm -f /tmp/gemini-models.json
candidates="$(cat /tmp/gemini-order.txt)"
rm -f /tmp/gemini-order.txt
[[ -n $candidates ]] || { echo "❌ চেনা কোনো মডেল পাওয়া গেল না।"; exit 1; }

echo "স্থিতিশীল মডেলগুলো একে একে দেখছি…"
for model in $candidates; do
  out="$(curl -s -o /tmp/gemini-probe.json -w '%{http_code}' -X POST \
    -H "x-goog-api-key: $key" -H 'Content-Type: application/json' \
    -d '{"contents":[{"parts":[{"text":"Reply with the single word: works"}]}]}' \
    "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent" || echo 000)"

  printf '  %-26s HTTP %s' "$model" "$out"
  if [[ $out == 200 ]]; then
    echo "  ✅"
    echo
    echo "Claude-কে এই নামটা বলো:  $model"
    rm -f /tmp/gemini-probe.json
    exit 0
  fi
  echo
  python3 -c "
import json
try:
    d=json.load(open('/tmp/gemini-probe.json'))
    print('     ', (d.get('error') or {}).get('message','')[:120])
except Exception: pass
" 2>/dev/null || true
done

rm -f /tmp/gemini-probe.json
echo
echo "❌ একটাও মডেল উত্তর দিল না। চাবি ঠিক আছে, কিন্তু কোটা নেই।"
exit 1
