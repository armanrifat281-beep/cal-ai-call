#!/usr/bin/env bash
# Writes the Supabase publishable key from the macOS clipboard into .env.
#
# Typing or pasting the key inside a shell command kept truncating it, so this
# reads the clipboard instead: press Copy on the Supabase API Keys page, then
# run this. The key is validated before it is written and never echoed.
set -euo pipefail

cd "$(dirname "$0")/.."

key="$(pbpaste | tr -d '[:space:]')"

if [[ ! $key =~ ^sb_publishable_[A-Za-z0-9_-]{20,}$ ]]; then
  echo "❌ Clipboard-এ Supabase publishable key নেই।"
  echo "   Supabase dashboard → Project Settings → API Keys → publishable key-এর"
  echo "   পাশের Copy বাটনে চাপ দাও, তারপর আবার এই স্ক্রিপ্টটা চালাও।"
  exit 1
fi

python3 - "$key" <<'PY'
import pathlib, re, sys
path = pathlib.Path('.env')
text = path.read_text()
line = f'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY={sys.argv[1]}'
text, n = re.subn(r'^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.*$', line, text, flags=re.M)
if n != 1:
    sys.exit(f'.env-এ key-এর লাইন {n} বার পাওয়া গেল, ১ বার হওয়া দরকার')
path.write_text(text)
PY

written="$(grep '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2-)"
if [[ $written == "$key" ]]; then
  echo "✅ Key বসেছে (${#written} অক্ষর)"
else
  echo "❌ লেখা হয়েছে কিন্তু মেলেনি — editor-এ .env খোলা থাকলে বন্ধ করে আবার চালাও।"
  exit 1
fi
