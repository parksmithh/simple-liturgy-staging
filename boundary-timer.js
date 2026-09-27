export function createBoundaryTimer({
  millisecondsUntilBoundary,
  isActive,
  setState,
  now = () => new Date(),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = timer => globalThis.clearTimeout(timer),
  onBoundary,
}) {
  let timer = null;

  function clear() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function schedule(date = now()) {
    clear();
    if (!isActive()) return;
    timer = setTimer(() => {
      timer = null;
      const boundaryTime = now();
      try {
        onBoundary(boundaryTime);
      } finally {
        schedule(boundaryTime);
      }
    }, millisecondsUntilBoundary(date));
  }

  function updateState(nextState, date = now()) {
    const state = setState(nextState);
    schedule(date);
    return state;
  }

  return {
    reschedule: schedule,
    setState: updateState,
    stop: clear,
  };
}
