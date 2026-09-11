import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { api } from '../api/axios';
import type { Attempt, Section3Prompt } from '@nqt/shared';

export interface Section2PassageItem {
  id: string;
  order_index: number;
  passage_text: string;
}

export interface Section2BatchData {
  total_passages: number;
  passages: Section2PassageItem[];
}

interface ExamSessionContextType {
  attempt: Attempt | null;
  setAttempt: (att: Attempt | null) => void;
  section2Batch: Section2BatchData | null;
  section3Prompt: Section3Prompt | null;
  prefetchSection2: (attemptId: string) => Promise<Section2BatchData | null>;
  prefetchSection3: (attemptId: string) => Promise<Section3Prompt | null>;
  getOrFetchSection2: (attemptId: string) => Promise<Section2BatchData | null>;
  getOrFetchSection3: (attemptId: string) => Promise<Section3Prompt | null>;
  clearSession: () => void;
}

const ExamSessionContext = createContext<ExamSessionContextType | undefined>(undefined);

export const ExamSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [section2Batch, setSection2Batch] = useState<Section2BatchData | null>(null);
  const [section3Prompt, setSection3Prompt] = useState<Section3Prompt | null>(null);

  const s2PromiseRef = useRef<Promise<Section2BatchData | null> | null>(null);
  const s3PromiseRef = useRef<Promise<Section3Prompt | null> | null>(null);

  const prefetchSection2 = useCallback(async (attemptId: string): Promise<Section2BatchData | null> => {
    if (section2Batch) return section2Batch;
    if (s2PromiseRef.current) return s2PromiseRef.current;

    s2PromiseRef.current = (async () => {
      try {
        const res = await api.get(`/candidate/attempts/${attemptId}/section2`);
        const data: Section2BatchData = res.data;
        setSection2Batch(data);
        return data;
      } catch (err) {
        console.error('[ExamSessionContext] Failed to prefetch Section 2 batch', err);
        return null;
      } finally {
        s2PromiseRef.current = null;
      }
    })();

    return s2PromiseRef.current;
  }, [section2Batch]);

  const prefetchSection3 = useCallback(async (attemptId: string): Promise<Section3Prompt | null> => {
    if (section3Prompt) return section3Prompt;
    if (s3PromiseRef.current) return s3PromiseRef.current;

    s3PromiseRef.current = (async () => {
      try {
        const res = await api.get(`/candidate/attempts/${attemptId}/section3`);
        const prompt: Section3Prompt = res.data.prompt;
        setSection3Prompt(prompt);
        return prompt;
      } catch (err) {
        console.error('[ExamSessionContext] Failed to prefetch Section 3 prompt', err);
        return null;
      } finally {
        s3PromiseRef.current = null;
      }
    })();

    return s3PromiseRef.current;
  }, [section3Prompt]);

  const getOrFetchSection2 = useCallback(async (attemptId: string): Promise<Section2BatchData | null> => {
    if (section2Batch) return section2Batch;
    return prefetchSection2(attemptId);
  }, [section2Batch, prefetchSection2]);

  const getOrFetchSection3 = useCallback(async (attemptId: string): Promise<Section3Prompt | null> => {
    if (section3Prompt) return section3Prompt;
    return prefetchSection3(attemptId);
  }, [section3Prompt, prefetchSection3]);

  const clearSession = useCallback(() => {
    setAttempt(null);
    setSection2Batch(null);
    setSection3Prompt(null);
    s2PromiseRef.current = null;
    s3PromiseRef.current = null;
  }, []);

  return (
    <ExamSessionContext.Provider
      value={{
        attempt,
        setAttempt,
        section2Batch,
        section3Prompt,
        prefetchSection2,
        prefetchSection3,
        getOrFetchSection2,
        getOrFetchSection3,
        clearSession,
      }}
    >
      {children}
    </ExamSessionContext.Provider>
  );
};

export function useExamSession(): ExamSessionContextType {
  const ctx = useContext(ExamSessionContext);
  if (!ctx) {
    throw new Error('useExamSession must be used within an ExamSessionProvider');
  }
  return ctx;
}

