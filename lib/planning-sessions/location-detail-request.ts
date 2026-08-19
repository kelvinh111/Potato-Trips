import { useEffect, useMemo, useRef, useState } from "react";

import { requestPlanningSessionLocationDetail } from "@/lib/planning-sessions/client-api";
import { shouldApplyLocationDetailResponse } from "@/lib/planning-sessions/location-detail-client-state";

export type LocationDetailRequestState =
  | { kind: "idle" }
  | { kind: "success"; detail: Awaited<ReturnType<typeof requestPlanningSessionLocationDetail>> }
  | { kind: "error"; message: string; retryable: boolean };

interface DetailRequestSnapshot {
  key: string;
  state: LocationDetailRequestState;
}

export function useLocationDetailRequest(input: {
  sessionId: string;
  itemId: string;
  activationVersion: number;
  shouldRequestProviderDetail: boolean;
}) {
  const [retryNonce, setRetryNonce] = useState(0);
  const requestIdRef = useRef(0);
  const requestKey = `${input.sessionId}:${input.itemId}:${input.activationVersion}:${retryNonce}`;
  const [requestSnapshot, setRequestSnapshot] = useState<DetailRequestSnapshot>(() => {
    return {
      key: requestKey,
      state: { kind: "idle" },
    };
  });

  const requestState = useMemo(() => {
    return requestSnapshot.key === requestKey
      ? requestSnapshot.state
      : ({ kind: "idle" } satisfies LocationDetailRequestState);
  }, [requestKey, requestSnapshot.key, requestSnapshot.state]);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!input.shouldRequestProviderDetail) {
      return;
    }

    void requestPlanningSessionLocationDetail(input.sessionId, input.itemId)
      .then((detail) => {
        if (!shouldApplyLocationDetailResponse({
          activeRequestId: requestIdRef.current,
          responseRequestId: requestId,
        })) {
          return;
        }

        setRequestSnapshot({
          key: requestKey,
          state: { kind: "success", detail },
        });
      })
      .catch((error) => {
        if (!shouldApplyLocationDetailResponse({
          activeRequestId: requestIdRef.current,
          responseRequestId: requestId,
        })) {
          return;
        }

        setRequestSnapshot({
          key: requestKey,
          state: {
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load location details right now. Please retry.",
            retryable:
              error instanceof Error
              && "retryable" in error
              && typeof error.retryable === "boolean"
                ? error.retryable
                : true,
          },
        });
      });
  }, [input.itemId, input.sessionId, input.shouldRequestProviderDetail, requestKey]);

  return {
    requestState,
    retry: () => {
      setRetryNonce((value) => value + 1);
    },
  };
}
