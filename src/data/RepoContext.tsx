import { createContext, useContext, type ReactNode } from 'react';
import type { Repos } from './repositories';

const RepoContext = createContext<Repos | null>(null);

export function RepoProvider({ repos, children }: { repos: Repos; children: ReactNode }) {
  return <RepoContext.Provider value={repos}>{children}</RepoContext.Provider>;
}

export function useRepos(): Repos {
  const repos = useContext(RepoContext);
  if (!repos) throw new Error('useRepos must be used inside RepoProvider');
  return repos;
}
