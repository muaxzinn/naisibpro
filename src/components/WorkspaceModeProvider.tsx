'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type WorkspaceMode = 'practice' | 'real-exam';

interface WorkspaceModeContextValue {
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  toggleWorkspaceMode: () => void;
}

const STORAGE_KEY = 'gp:workspace-mode:v1';

const WorkspaceModeContext = createContext<WorkspaceModeContextValue>({
  workspaceMode: 'practice',
  setWorkspaceMode: () => {},
  toggleWorkspaceMode: () => {},
});

export function WorkspaceModeProvider({ children }: { children: React.ReactNode }) {
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>('practice');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'real-exam' || saved === 'practice') {
        setWorkspaceModeState(saved);
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  const setWorkspaceMode = useCallback((next: WorkspaceMode) => {
    setWorkspaceModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleWorkspaceMode = useCallback(() => {
    setWorkspaceModeState((prev) => {
      const next: WorkspaceMode = prev === 'practice' ? 'real-exam' : 'practice';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <WorkspaceModeContext.Provider
      value={{ workspaceMode, setWorkspaceMode, toggleWorkspaceMode }}
    >
      {children}
    </WorkspaceModeContext.Provider>
  );
}

export function useWorkspaceMode() {
  return useContext(WorkspaceModeContext);
}
