import type { PriorityLevel } from './priorities'

export type TflushWork = (hasTimeRemaining: boolean, initialTime: number) => boolean;

export type TimeoutID = number

export type Heap<T extends Task> = Array<T>;
export type FrameCallbackType = (didTaskTimeout: boolean) => void | FrameCallbackType;
export type Task = {
  id: number,
  sortIndex: number,
  callback: FrameCallbackType | boolean | null,
  priorityLevel: PriorityLevel,
  startTime: number,
  expirationTime: number,
  isQueued?: boolean,
};
// export interface CallbackNode {
//   callback: FrameCallbackType;
//   priorityLevel: number;
//   expirationTime: number;
//   next: CallbackNode | null;
//   prev: CallbackNode | null;
// }