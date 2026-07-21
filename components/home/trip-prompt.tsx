"use client";

import { ArrowUp, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
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

export function TripPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorSequenceRef = useRef(0);
  const errorTimerRef = useRef<number | null>(null);

  const scheduleErrorMessage = (message: string) => {
    errorSequenceRef.current += 1;
    const currentSequence = errorSequenceRef.current;

    setErrorMessage(message);

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

    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
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
      scheduleErrorMessage("Enter a trip prompt between 1 and 2000 characters.");
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
        scheduleErrorMessage(
          "Could not start planning session. Please try again.",
        );
        return;
      }

      let responseBody: CreatePlanningSessionResponse;

      try {
        responseBody = (await response.json()) as CreatePlanningSessionResponse;
      } catch {
        scheduleErrorMessage(
          "Could not start planning session. Please try again.",
        );
        return;
      }

      const parsedSessionId = planningSessionIdSchema.safeParse(
        responseBody.session?.id,
      );

      if (!parsedSessionId.success) {
        scheduleErrorMessage(
          "Could not start planning session. Please try again.",
        );
        return;
      }

      savePlanningSessionId(parsedSessionId.data);
      router.push(`/plan/${encodeURIComponent(parsedSessionId.data)}`);
    } catch {
      scheduleErrorMessage(
        "Network problem while starting session. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl rounded-3xl border border-border-default bg-bg-surface shadow-sm">
        <CardContent className="space-y-5 px-4 pb-5 pt-6 sm:px-6 sm:pt-7">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              What trip do you want?
            </h1>
            <p className="mx-auto max-w-lg text-sm text-text-secondary sm:text-base">
              Tell me what you have in mind and I&apos;ll create an itinerary for
              you.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative space-y-3">
            <label htmlFor="trip-prompt" className="sr-only">
              Describe your trip
            </label>
            <Textarea
              id="trip-prompt"
              name="trip-prompt"
              placeholder="A solo 7-day trip to Osaka in August..."
              rows={5}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isSubmitting}
              aria-invalid={errorMessage ? "true" : "false"}
              aria-describedby={errorMessage ? "trip-prompt-error" : undefined}
              className="resize-none rounded-2xl border-border-default bg-bg-surface pr-12 text-text-primary placeholder:text-text-faint"
            />
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Submit trip prompt"
              disabled={isSubmitting}
              className="absolute right-3 bottom-3 rounded-full"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>

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
