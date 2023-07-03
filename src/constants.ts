const ImmediatePriority = 1;
const UserBlockingPriority = 2;
const NormalPriority = 3;
const LowPriority = 4;
const IdlePriority = 5;

export const maxSigned31BitInt = 0b111111111111111111111111111111; // Times out immediately

export const IMMEDIATE_PRIORITY_TIMEOUT = -1; // Eventually times out

export const USER_BLOCKING_PRIORITY_TIMEOUT = 250;
export const NORMAL_PRIORITY_TIMEOUT = 5000;
export const LOW_PRIORITY_TIMEOUT = 10000; // Never times out

export const IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;