import React from 'react';

/**
 * Inserts a tab character ('\t') at the current cursor location and updates component state,
 * preventing default element blurring / focus loss.
 */
export function handleTabInsert(
  e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  onChange: (value: string) => void
) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const value = target.value;

    const updated = value.substring(0, start) + '\t' + value.substring(end);
    onChange(updated);

    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = start + 1;
    });
  }
}

