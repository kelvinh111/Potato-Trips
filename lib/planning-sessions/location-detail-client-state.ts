export function shouldApplyLocationDetailResponse(input: {
  activeRequestId: number;
  responseRequestId: number;
}): boolean {
  return input.activeRequestId === input.responseRequestId;
}
