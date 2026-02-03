import * as React from "react";

export function useResponseTimer() {
  const startRef = React.useRef<number>(Date.now());

  const reset = React.useCallback(() => {
    startRef.current = Date.now();
  }, []);

  const elapsedMs = React.useCallback(() => {
    return Date.now() - startRef.current;
  }, []);

  const startAtMs = React.useCallback(() => startRef.current, []);

  return { reset, elapsedMs, startAtMs };
}
