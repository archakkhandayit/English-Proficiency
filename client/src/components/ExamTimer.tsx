import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire();
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, onExpire]);

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
      className={`font-timer-display text-timer-display tabular-nums ${colorClass}`}
      aria-label={`Time Remaining: ${formattedTime}`}
    >
      {formattedTime}
    </span>
  );
};


