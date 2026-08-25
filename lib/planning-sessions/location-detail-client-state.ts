export function shouldApplyLocationDetailResponse(input: {
  activeRequestId: number;
  responseRequestId: number;
}): boolean {
  return input.activeRequestId === input.responseRequestId;
}

export function shouldStartLocationDetailRequest(input: {
  hasItemContext: boolean;
  shouldRequestProviderDetail: boolean;
  requestKey: string;
  activeRequestKey: string | null;
}): boolean {
  if (!input.hasItemContext || !input.shouldRequestProviderDetail) {
    return false;
  }

  return input.requestKey !== input.activeRequestKey;
}
