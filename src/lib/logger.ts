/**
 * Minimal logger with redaction.
 *
 * Rules this enforces:
 *  - nothing is logged in release builds except warnings and errors;
 *  - keys that commonly hold secrets or personal data are masked.
 */

const REDACT_KEY_PATTERN =
  /(token|key|secret|password|authorization|anon|jwt|email|allerg|refresh)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACT_KEY_PATTERN.test(key) ? '[redacted]' : redact(inner, depth + 1);
  }
  return out;
}

function emit(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: unknown,
): void {
  if (!__DEV__ && (level === 'debug' || level === 'info')) return;

  const payload = context === undefined ? '' : JSON.stringify(redact(context));
  const line = payload ? `[foodlens] ${message} ${payload}` : `[foodlens] ${message}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: unknown) => emit('debug', message, context),
  info: (message: string, context?: unknown) => emit('info', message, context),
  warn: (message: string, context?: unknown) => emit('warn', message, context),
  error: (message: string, context?: unknown) => emit('error', message, context),
};
