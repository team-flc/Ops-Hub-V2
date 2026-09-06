import { useNavigate, useParams, useLocation } from 'react-router-dom';

/**
 * Safe wrapper around useNavigate that returns a no-op function
 * when rendered outside of a <Router> provider (e.g. in isolated unit tests).
 */
export function useSafeNavigate() {
  try {
    return useNavigate();
  } catch {
    return (_to: any) => {};
  }
}

/**
 * Safe wrapper around useParams that returns an empty object
 * when rendered outside of a <Router> provider.
 */
export function useSafeParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  try {
    const p = useParams();
    return (p as unknown as T) || ({} as T);
  } catch {
    return {} as T;
  }
}

/**
 * Safe wrapper around useLocation that returns a default location object
 * when rendered outside of a <Router> provider.
 */
export function useSafeLocation() {
  try {
    return useLocation();
  } catch {
    return { pathname: '/', search: '', hash: '', state: null, key: 'default' };
  }
}
