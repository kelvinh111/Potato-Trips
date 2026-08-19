export type LocationDetailActivationInteraction =
  | "card-click"
  | "card-enter"
  | "card-space"
  | "title-click"
  | "title-enter"
  | "title-space"
  | "hover"
  | "focus"
  | "marker-click";

export function shouldSelectItemForInteraction(
  kind: LocationDetailActivationInteraction,
): boolean {
  return kind === "card-click" || kind === "card-enter" || kind === "card-space";
}

export function shouldOpenDetailForTitleInteraction(
  kind: LocationDetailActivationInteraction,
): boolean {
  return kind === "title-click" || kind === "title-enter" || kind === "title-space";
}
