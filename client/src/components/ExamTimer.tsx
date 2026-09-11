import React, { useState, useEffect, useRef } from 'react';

interface ExamTimerProps {
  initialSeconds: number;
  onExpire: () => void;
  warningThresholdSeconds?: number;
  criticalThresholdSeconds?: number;
  label?: string;
}

export const ExamTimer: React.FC<ExamTimerProps> = ({
  initialSeconds,
  onExpire,
  warningThresholdSeconds = 60,
  criticalThresholdSeconds = 15,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);

  // Keep callback reference updated without triggering interval re-creations
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    setSecondsLeft(initialSeconds);
    if (initialSeconds <= 0) return;

    // Use absolute timestamp countdown to eliminate typing freezes and interval drift
    const endTime = Date.now() + initialSeconds * 1000;
    let hasExpired = false;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0 && !hasExpired) {
        hasExpired = true;
        clearInterval(interval);
        onExpireRef.current?.();
      }
    };

    tick();
    const interval = setInterval(tick, 250);

    return () => clearInterval(interval);
  }, [initialSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isCritical = secondsLeft <= criticalThresholdSeconds;
  const isWarning = !isCritical && secondsLeft <= warningThresholdSeconds;

  let colorClass = 'text-text-primary';
  if (isCritical) {
    colorClass = 'text-timer-critical animate-pulse font-bold';
  } else if (isWarning) {
    colorClass = 'text-timer-warning font-semibold';
  }

  return (
    <span
      className={`font-timer-display text-timer-display tabular-nums select-none ${colorClass}`}
      aria-label={`Time Remaining: ${formattedTime}`}
    >
      {formattedTime}
    </span>
  );
};



