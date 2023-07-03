
export const isInputPending =
typeof navigator !== 'undefined' &&
  // $FlowFixMe[prop-missing]
  // @ts-ignore
  navigator.scheduling !== undefined &&
  // $FlowFixMe[incompatible-type]
  // @ts-ignore
  navigator.scheduling.isInputPending !== undefined
  // @ts-ignore
  ? navigator.scheduling.isInputPending.bind(navigator.scheduling)
  : null;
