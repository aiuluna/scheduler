let getCurrentTime: () => number;
const hasPerformanceNow = typeof performance === 'object' && typeof performance.now === 'function';

if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();
} else {
  const localData = Date;
  const initialTime = localData.now()
  getCurrentTime = () => localData.now() - initialTime;
}

const localSetTimeout = typeof setTimeout === 'function' ? setTimeout : null;
const localClearTimeout =
  typeof clearTimeout === 'function' ? clearTimeout : null;
const localSetImmediate =
  typeof setImmediate !== 'undefined' ? setImmediate : null; // IE and Node.js + jsdom

let startTimeRef = {current: -1};

export {
  getCurrentTime,
  localSetTimeout,
  localClearTimeout,
  localSetImmediate,
  startTimeRef
}
