import { useState } from 'react';

import { TextField, type TextFieldProps } from './TextField';

export interface NumberFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'keyboardType' | 'error'> {
  /** Current value, or null when the field is empty. */
  value: number | null;
  onChangeValue: (next: number | null) => void;
  /** Allow a decimal point. Off for whole-number fields like calories. */
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  /** Validation message from the parent, shown instead of the internal one. */
  error?: string | null;
  /** Required fields reject an empty value. */
  requireValue?: boolean;
}

/**
 * Numeric input that keeps the user's raw keystrokes while typing.
 *
 * Reformatting a number on every keystroke fights the user ("0.5" becomes "0"
 * halfway through), so the text is held locally and only parsed values are
 * pushed up.
 */
export function NumberField({
  value,
  onChangeValue,
  allowDecimal = true,
  min = 0,
  max,
  error,
  requireValue = false,
  ...rest
}: NumberFieldProps) {
  const [text, setText] = useState(() => (value === null ? '' : String(value)));
  const [touched, setTouched] = useState(false);

  const pattern = allowDecimal ? /^\d*(\.\d*)?$/ : /^\d*$/;

  const handleChange = (next: string) => {
    // Accept the keystroke only if it keeps the text a valid partial number.
    const normalized = next.replace(',', '.');
    if (!pattern.test(normalized)) return;

    setText(normalized);

    if (normalized === '' || normalized === '.') {
      onChangeValue(null);
      return;
    }
    const parsed = Number.parseFloat(normalized);
    onChangeValue(Number.isFinite(parsed) ? parsed : null);
  };

  const internalError = (() => {
    if (!touched) return null;
    if (text.trim() === '') return requireValue ? 'Enter a number.' : null;
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed)) return 'Enter a number.';
    if (parsed < min) return `Must be ${min} or more.`;
    if (max !== undefined && parsed > max) return `Must be ${max} or less.`;
    return null;
  })();

  return (
    <TextField
      {...rest}
      value={text}
      onChangeText={handleChange}
      onBlur={() => setTouched(true)}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      error={error ?? internalError}
    />
  );
}
