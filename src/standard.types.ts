import type { PriorityLevel } from './priorities'

export type TflushWork = (hasTimeRemaining: boolean, initialTime: number) => boolean;

export type TimeoutID = number

export type Heap<T extends Task> = Array<T>;
export type Callback = (didTaskTimeout: boolean) => void | Callback;
export type Task = {
  id: number,
  sortIndex: number,
  callback: Callback | boolean | null,
  priorityLevel: PriorityLevel,
  startTime: number,
  expirationTime: number,
  isQueued?: boolean,
};