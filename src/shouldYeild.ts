import { getCurrentTime, startTimeRef } from './localTimerFunctions'
import { isInputPending } from './isInputPending'

const frameYieldMs = 5;


export function shouldYield(): boolean {
  const timeElapsed = getCurrentTime() - startTimeRef.current;
  return (isInputPending() || timeElapsed >= frameYieldMs) ? true : false;
}