"use client";

import { ArrowUp, LoaderCircle } from "lucide-react";
import {
  FormEvent,
  KeyboardEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { savePlanningSessionId } from "@/lib/planning-sessions/storage";
import {
  createPlanningSessionBodySchema,
  planningSessionIdSchema,
} from "@/lib/planning-sessions/validation";

const ERROR_DISMISS_DELAY_MS = 4500;

interface CreatePlanningSessionResponse {
  session?: {
    id?: unknown;
  };
}

type PromptErrorKind = "validation" | "submission";

export function TripPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PromptErrorKind | null>(null);
  const errorSequenceRef = useRef(0);
  const errorTimerRef = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const isImeComposingRef = useRef(false);

  const scheduleErrorMessage = (message: string, kind: PromptErrorKind) => {
    errorSequenceRef.current += 1;
    const currentSequence = errorSequenceRef.current;

    setErrorMessage(message);
    setErrorKind(kind);

    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
    }

    errorTimerRef.current = window.setTimeout(() => {
      if (errorSequenceRef.current === currentSequence) {
        setErrorMessage(null);
      }
    }, ERROR_DISMISS_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const clearErrorState = () => {
    errorSequenceRef.current += 1;
    setErrorMessage(null);
    setErrorKind(null);

    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  };

  const failSubmission = (message: string, kind: PromptErrorKind) => {
    scheduleErrorMessage(message, kind);
    setIsSubmitting(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearErrorState();

    const parsedBody = createPlanningSessionBodySchema.safeParse({
      initialPrompt: prompt.trim(),
    });

    if (!parsedBody.success) {
      failSubmission(
        "Enter a trip prompt between 1 and 2000 characters.",
        "validation",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/planning-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ initialPrompt: parsedBody.data.initialPrompt }),
      });

      if (!response.ok) {
        failSubmission(
          "Could not start planning session. Please try again.",
          "submission",
        );
        return;
      }

      let responseBody: CreatePlanningSessionResponse;

      try {
        responseBody = (await response.json()) as CreatePlanningSessionResponse;
      } catch {
        failSubmission(
          "Could not start planning session. Please try again.",
          "submission",
        );
        return;
      }

      const parsedSessionId = planningSessionIdSchema.safeParse(
        responseBody.session?.id,
      );

      if (!parsedSessionId.success) {
        failSubmission(
          "Could not start planning session. Please try again.",
          "submission",
        );
        return;
      }

      savePlanningSessionId(parsedSessionId.data);
      router.push(`/plan/${encodeURIComponent(parsedSessionId.data)}`);
    } catch {
      failSubmission(
        "Network problem while starting session. Please try again.",
        "submission",
      );
    }
  };

  const handlePromptKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (
    event,
  ) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const nativeEvent = event.nativeEvent as KeyboardEvent;
    const isComposingIme =
      nativeEvent.isComposing || nativeEvent.keyCode === 229;

    if (isImeComposingRef.current) {
      if (!isComposingIme) {
        // Treat this Enter as IME candidate confirmation and require another Enter to submit.
        isImeComposingRef.current = false;
      }

      return;
    }

    if (isComposingIme) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  };

  return (
    <section className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl rounded-[3rem] border-0 bg-accent-secondary shadow-[0_30px_120px_rgba(0,0,0,0.15)] ring-0">
        <CardContent className="space-y-5 px-4 pb-5 pt-6 sm:px-6 sm:pt-7">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              What trip do you want?
            </h1>
            <p className="mx-auto max-w-lg text-sm text-black sm:text-base">
              Tell me what you have in mind and I&apos;ll create an itinerary for
              you.
            </p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="relative space-y-3">
            <label htmlFor="trip-prompt" className="sr-only">
              Describe your trip
            </label>
            <div className="relative">
              <Textarea
                id="trip-prompt"
                name="trip-prompt"
                placeholder="A solo 7-day trip to Osaka in August..."
                rows={1}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={isSubmitting}
                onCompositionStart={() => {
                  isImeComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isImeComposingRef.current = false;
                }}
                onBlur={() => {
                  isImeComposingRef.current = false;
                }}
                onKeyDown={handlePromptKeyDown}
                aria-invalid={errorKind === "validation" ? "true" : "false"}
                aria-describedby={errorMessage ? "trip-prompt-error" : undefined}
                className="min-h-0 resize-none rounded-4xl border-0 bg-bg-surface px-5 py-3 pr-14 text-text-primary placeholder:text-text-faint outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                type="submit"
                size="icon-sm"
                aria-label="Submit trip prompt"
                disabled={isSubmitting}
                className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer rounded-full bg-black text-white hover:bg-black/90"
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>

            {errorMessage && (
              <p
                id="trip-prompt-error"
                role="status"
                aria-live="polite"
                className="text-sm text-state-error"
              >
                {errorMessage}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
