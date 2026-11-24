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
    let hasLocal = false;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'real-exam' || saved === 'practice') {
        setWorkspaceModeState(saved);
        hasLocal = true;
      }
    } catch {
      // ignore storage access errors
    }
    if (!hasLocal) {
      fetch('/api/profile', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const remoteMode = d?.profile?.examSettings?.workspaceMode;
          if (remoteMode === 'real-exam' || remoteMode === 'practice') {
            setWorkspaceModeState(remoteMode);
            try {
              window.localStorage.setItem(STORAGE_KEY, remoteMode);
            } catch {
              // ignore
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const persistWorkspaceMode = useCallback((next: WorkspaceMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examSettings: { workspaceMode: next } }),
    }).catch(() => {});
  }, []);

  const setWorkspaceMode = useCallback(
    (next: WorkspaceMode) => {
      setWorkspaceModeState(next);
      persistWorkspaceMode(next);
    },
    [persistWorkspaceMode]
  );

  const toggleWorkspaceMode = useCallback(() => {
    setWorkspaceModeState((prev) => {
      const next: WorkspaceMode = prev === 'practice' ? 'real-exam' : 'practice';
      persistWorkspaceMode(next);
      return next;
    });
  }, [persistWorkspaceMode]);

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
