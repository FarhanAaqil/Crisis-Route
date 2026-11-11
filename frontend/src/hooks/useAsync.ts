import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  key: string;
  data?: T;
  error?: string;
}

export interface AsyncResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Run an async loader whenever `deps` change and expose loading / error / data.
 * Stale responses are discarded, and the previous data stays visible while a reload runs so
 * the screen never flashes empty.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: ReadonlyArray<unknown>): AsyncResult<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ key: '' });
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const key = `${JSON.stringify(deps)}#${version}`;

  useEffect(() => {
    let cancelled = false;
    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ key, data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((prev) => ({ key, data: prev.data, error: errorMessage(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const settled = state.key === key;
  return {
    data: state.data ?? null,
    error: settled ? (state.error ?? null) : null,
    loading: !settled,
    reload,
  };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
