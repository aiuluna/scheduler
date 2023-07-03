import { push, pop, peek } from './minHeap';

import type { PriorityLevel } from './priorities';
import {
  NoPriority,
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority
} from './priorities'

import {
  IMMEDIATE_PRIORITY_TIMEOUT,
  USER_BLOCKING_PRIORITY_TIMEOUT,
  NORMAL_PRIORITY_TIMEOUT,
  LOW_PRIORITY_TIMEOUT,
  IDLE_PRIORITY_TIMEOUT
} from './constants'
import { getCurrentTime, localClearTimeout, localSetImmediate, localSetTimeout, startTimeRef } from './localTimerFunctions';

import { shouldYeild } from './shouldYeild'

import { TflushWork, TimeoutID, Heap, Task, Callback } from './standard.types';

const taskQueue: Heap<Task> = [];
const timerQueue: Heap<Task> = [];
// 自增长的taskIdCounter，用于定义task
let taskIdCounter = -1;
let currentTask: Task | null = null;
let currentPriorityLevel = NormalPriority;

let taskTimeoutID: TimeoutID = (-1 as number);

// 是否有延迟任务在执行
let isHostTimeoutScheduled = false;
// 是否有task任务在执行
let isHostCallbackScheduled = false;
// 被调度的回调任务
let scheduledHostCallback: TflushWork | null = null;
let isMessageLoopRunning = false;
// 防止重入，在执行perform工作时设置为true
let isPerformingWork = false;

/**
 * 检查已经不延迟的延迟队列任务并且将其放到任务队列
 * @param currentTime 
 */
function advanceTimers(currentTime: number) {
  let timer = peek(timerQueue);

  while (timer !== null) {
    if (!timer.callback) {
      pop(timerQueue)
    } else if (timer.startTime <= currentTime) {
      pop(timerQueue)
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer)
    } else {
      return
    }
    timer = peek(timerQueue)
  }
}

/**
 * 在空闲时预分发callback回调函数的执行时机
 * @param currentTime 
 */
function handleTimeout(currentTime: number) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);

  if (!isHostCallbackScheduled) {
    if (peek(taskQueue)) {
      isHostCallbackScheduled = true
      requestHostCallback(flushWork)
    } else {
      const firstTimer = peek(timerQueue)
      if (firstTimer) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime)
      }
    }
  }
}

/**
 * 开始执行workloop的函数
 * @param hasTimeRemaining 
 * @param initialTime 
 * @returns 
 */
function flushWork(hasTimeRemaining: boolean, initialTime: number): boolean {
  isHostCallbackScheduled = false;

  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout()
  }

  isPerformingWork = true;
  // 将当前任务优先级设置为之前task优先级
  const previousPriorityLevel = currentPriorityLevel;
  try {
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    currentTask = null;
    isPerformingWork = false;
    currentPriorityLevel = previousPriorityLevel;
  }
}

/**
 * 调度循环主体
 * @param hasTimeRemaining 
 * @param initialTime 
 * @returns 
 */
function workLoop(hasTimeRemaining: boolean, initialTime: number): boolean {
  let currentTime = initialTime;
  advanceTimers(currentTime);
  currentTask = peek(taskQueue);
  while (currentTask) {
    // 退出循环的条件
    if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYeild())) {
      break
    }

    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      currentPriorityLevel = currentTask.priorityLevel;

      const didTaskTimeout = currentTask.expirationTime - currentTime <= 0;
      const continuationCallback = callback(didTaskTimeout);
      // 一个perform执行完重新获取下时间
      currentTime = getCurrentTime();
      if (continuationCallback && typeof continuationCallback === 'function') {
        // 复用task
        currentTask.callback = continuationCallback;
        advanceTimers(currentTime)
        return true
      } else {
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue)
        }
        advanceTimers(currentTime);
      }
    } else {
      pop(taskQueue)
    }
    currentTask = peek(taskQueue)
  }

  // 如果还有task,返回还有未完成的任务，否则调度handleTimeout里的没有task的分支
  if (currentTask) {
    return true
  } else {
    const firstTimer = peek(timerQueue);
    if (firstTimer) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime)
    }
    return false
  }
}


function requestHostCallback(callback: TflushWork) {
  scheduledHostCallback = callback;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

/**
 * 安排执行直到截止时间的工作
 * 在下个宏任务中开始执行
 */
let schedulePerformWorkUntilDeadline;
if (typeof localSetImmediate === 'function') {
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate!(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== 'undefined') {
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => {
    port.postMessage(null);
  };
} else {
  schedulePerformWorkUntilDeadline = () => {
    localSetTimeout && localSetTimeout(performWorkUntilDeadline, 0);
  };
}

/**
 * 执行直到截止时间的工作
 * 对flushwork的一层封装，如果flushwork返回true就下次宏任务继续执行
 * 自己调度自己
 */
function performWorkUntilDeadline() {
  if (scheduledHostCallback) {
    const hasTimeRemaining = true;
    const currentTime = getCurrentTime();
    startTimeRef.current = currentTime;

    let hasMore = true;
    try {
      hasMore = scheduledHostCallback(hasTimeRemaining, currentTime)
    } finally {
      if (hasMore) {
        schedulePerformWorkUntilDeadline()
      } else {
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    isMessageLoopRunning = false;
  }
}


function requestHostTimeout(callback: (currentTime: number) => void, ms: number) {
  taskTimeoutID = localSetTimeout!(() => {
    callback(getCurrentTime())
  }, ms) as unknown as number;
}

export function cancelHostTimeout() {
  localClearTimeout && localClearTimeout(taskTimeoutID)
  taskTimeoutID = -1;
}

export const scheduledCallback:
  (priorityLevel: PriorityLevel, callback: Callback, options?: { delay: number }) => Task
  = (priorityLevel, callback, options) => {

    const currentTime = getCurrentTime();
    let startTime = currentTime;
    if (typeof options === 'object' && options !== null) {
      const { delay } = options;
      if (typeof delay === 'number' && delay > 0) {
        startTime += delay
      }
    }

    let timeout;
    switch (priorityLevel) {
      case ImmediatePriority:
        timeout = IMMEDIATE_PRIORITY_TIMEOUT;
        break;
      case UserBlockingPriority:
        timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
        break;
      case IdlePriority:
        timeout = IDLE_PRIORITY_TIMEOUT;
        break;
      case LowPriority:
        timeout = LOW_PRIORITY_TIMEOUT;
        break;
      case NormalPriority:
      default:
        timeout = NORMAL_PRIORITY_TIMEOUT;
        break;
    }

    const expirationTime = startTime + timeout;
    const newTask: Task = {
      id: taskIdCounter++,
      callback,
      sortIndex: -1,
      priorityLevel,
      startTime,
      expirationTime
    }

    if (startTime > currentTime) {
      // timerQueue
      newTask.sortIndex = startTime;
      push(timerQueue, newTask)
      if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
        if (isHostTimeoutScheduled) {
          cancelHostTimeout()
        } else {
          isHostTimeoutScheduled = true
        }
        requestHostTimeout(handleTimeout, startTime - currentTime)
      }
    } else {
      newTask.sortIndex = expirationTime;
      push(taskQueue, newTask)
      if (!isHostCallbackScheduled && !isPerformingWork) {
        requestHostCallback(flushWork)
      }
    }

    return newTask;
  }