export type LocationDetailInteractionKind =
  | "hover"
  | "focus"
  | "click"
  | "keyboard-enter"
  | "touch"
  | "blur"
  | "leave";

export function shouldPreviewMapMarkerForInteraction(input: {
  kind: LocationDetailInteractionKind;
  isMapInteractive: boolean;
}): boolean {
  if (!input.isMapInteractive) {
    return false;
  }

  return input.kind === "hover" || input.kind === "focus";
}

export function shouldOpenLocationDetailForInteraction(
  kind: LocationDetailInteractionKind,
): boolean {
  return kind === "click" || kind === "keyboard-enter" || kind === "touch";
}

export function shouldRequestProviderDetailForInteraction(input: {
  kind: LocationDetailInteractionKind;
  hasGooglePlaceId: boolean;
}): boolean {
  return (
    input.hasGooglePlaceId
    && shouldOpenLocationDetailForInteraction(input.kind)
  );
}
