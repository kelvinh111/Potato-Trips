import "server-only";

const GENERIC_MATCH_TOKENS = new Set([
  "and",
  "at",
  "city",
  "de",
  "des",
  "du",
  "garden",
  "gardens",
  "hotel",
  "in",
  "la",
  "le",
  "les",
  "museum",
  "of",
  "park",
  "place",
  "plaza",
  "restaurant",
  "square",
  "station",
  "temple",
  "the",
]);

const SAFE_ALIAS_DESCRIPTOR_TOKENS = new Set([
  "de",
  "des",
  "du",
  "of",
  "la",
  "le",
  "les",
  "garden",
  "jardin",
  "museum",
  "musee",
  "temple",
  "the",
]);

const PLACE_TYPE_DESCRIPTOR_GROUPS: Record<string, string> = {
  aquarium: "aquarium",
  waterpark: "aquarium",
  museum: "museum",
  musee: "museum",
  "博物館": "museum",
  garden: "garden",
  jardin: "garden",
  zoo: "zoo",
  gallery: "gallery",
  galerie: "gallery",
  opera: "opera",
  "水族館": "aquarium",
};

export function isDisplayNameCompatibleWithIdentity(
  expectedIdentity: string,
  displayName: string,
): boolean {
  const normalizedExpectedIdentity = normalizeSearchText(expectedIdentity);
  const normalizedDisplayName = normalizeSearchText(displayName);

  if (!normalizedExpectedIdentity || !normalizedDisplayName) {
    return false;
  }

  if (normalizedExpectedIdentity === normalizedDisplayName) {
    return true;
  }

  const expectedIdentityWords = tokenizeSearchText(normalizedExpectedIdentity);
  const displayNameWords = tokenizeSearchText(normalizedDisplayName);

  if (expectedIdentityWords.length === 0 || displayNameWords.length === 0) {
    return false;
  }

  const shorterWords =
    expectedIdentityWords.length <= displayNameWords.length
      ? expectedIdentityWords
      : displayNameWords;
  const longerWords =
    expectedIdentityWords.length <= displayNameWords.length
      ? displayNameWords
      : expectedIdentityWords;

  if (
    displayNameWords.length > expectedIdentityWords.length
    && containsWholePhrase(displayNameWords, expectedIdentityWords)
    && !hasSafeContainmentAliasTokens(displayNameWords, expectedIdentityWords)
  ) {
    return false;
  }

  const expectedDescriptorGroups = derivePlaceTypeDescriptorGroups(expectedIdentityWords);
  const displayDescriptorGroups = derivePlaceTypeDescriptorGroups(displayNameWords);

  if (
    expectedDescriptorGroups.size > 0
    && displayDescriptorGroups.size > 0
    && !hasOverlappingDescriptorGroup(expectedDescriptorGroups, displayDescriptorGroups)
  ) {
    return false;
  }

  if (shorterWords.length >= 2 && containsWholePhrase(longerWords, shorterWords)) {
    if (hasSafeContainmentAliasTokens(longerWords, shorterWords)) {
      return true;
    }
  }

  const expectedIdentityWordSet = new Set(expectedIdentityWords);
  const sharedWords = displayNameWords.filter((word, index, words) => {
    return expectedIdentityWordSet.has(word) && words.indexOf(word) === index;
  });

  if (sharedWords.length === 0) {
    return false;
  }

  const sharedDistinctiveWords = sharedWords.filter((word) => !isGenericMatchToken(word));
  if (sharedDistinctiveWords.length === 0) {
    return false;
  }

  if (sharedDistinctiveWords.length >= 2) {
    return true;
  }

  const distinctiveToken = sharedDistinctiveWords[0] ?? null;
  if (!distinctiveToken) {
    return false;
  }

  const distinctiveExpectedIdentityWords = expectedIdentityWords.filter(
    (word) => !isGenericMatchToken(word),
  );
  const distinctiveDisplayWords = displayNameWords.filter((word) => !isGenericMatchToken(word));

  const unmatchedDistinctiveExpectedWords = distinctiveExpectedIdentityWords.filter((word) => {
    return !sharedDistinctiveWords.includes(word);
  });
  const unmatchedDistinctiveDisplayWords = distinctiveDisplayWords.filter((word) => {
    return !sharedDistinctiveWords.includes(word);
  });

  if (
    sharedDistinctiveWords.length === 1
    && /[^\x00-\x7F]/.test(distinctiveToken)
    && (expectedIdentityWords.length === 1 || displayNameWords.length === 1)
  ) {
    return true;
  }

  if (
    unmatchedDistinctiveExpectedWords.length > 0
    && unmatchedDistinctiveDisplayWords.length > 0
  ) {
    return false;
  }

  if (sharedDistinctiveWords.length === 1) {
    const extraExpectedWords = expectedIdentityWords.filter((word) => word !== distinctiveToken);
    const extraDisplayWords = displayNameWords.filter((word) => word !== distinctiveToken);

    if (extraExpectedWords.length > 0 && extraDisplayWords.length > 0) {
      const expectedExtrasAreSafe = extraExpectedWords.every((word) => {
        return SAFE_ALIAS_DESCRIPTOR_TOKENS.has(word);
      });
      const displayExtrasAreSafe = extraDisplayWords.every((word) => {
        return SAFE_ALIAS_DESCRIPTOR_TOKENS.has(word);
      });

      if (!expectedExtrasAreSafe || !displayExtrasAreSafe) {
        return false;
      }
    }
  }

  return (
    distinctiveToken.length >= 4
    && expectedIdentityWords.length >= 2
    && displayNameWords.length >= 2
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericMatchToken(value: string): boolean {
  return GENERIC_MATCH_TOKENS.has(value);
}

function tokenizeSearchText(value: string): string[] {
  return value.split(" ").filter((part) => part.length > 0);
}

function derivePlaceTypeDescriptorGroups(words: string[]): Set<string> {
  const groups = new Set<string>();

  words.forEach((word) => {
    const group = PLACE_TYPE_DESCRIPTOR_GROUPS[word];
    if (group) {
      groups.add(group);
    }
  });

  return groups;
}

function hasOverlappingDescriptorGroup(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }

  return false;
}

function hasSafeContainmentAliasTokens(
  longerWords: string[],
  containedPhraseWords: string[],
): boolean {
  if (containedPhraseWords.length === 0 || longerWords.length < containedPhraseWords.length) {
    return false;
  }

  for (let i = 0; i <= longerWords.length - containedPhraseWords.length; i += 1) {
    let matches = true;

    for (let j = 0; j < containedPhraseWords.length; j += 1) {
      if (longerWords[i + j] !== containedPhraseWords[j]) {
        matches = false;
        break;
      }
    }

    if (!matches) {
      continue;
    }

    const beforeTokens = longerWords.slice(0, i);
    const afterTokens = longerWords.slice(i + containedPhraseWords.length);
    const extraTokens = beforeTokens.concat(afterTokens);

    if (extraTokens.every((token) => SAFE_ALIAS_DESCRIPTOR_TOKENS.has(token))) {
      return true;
    }
  }

  return false;
}

function containsWholePhrase(haystackWords: string[], phraseWords: string[]): boolean {
  if (phraseWords.length === 0 || haystackWords.length < phraseWords.length) {
    return false;
  }

  for (let i = 0; i <= haystackWords.length - phraseWords.length; i += 1) {
    let matches = true;

    for (let j = 0; j < phraseWords.length; j += 1) {
      if (haystackWords[i + j] !== phraseWords[j]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
}
