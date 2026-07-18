"use client";

import { ArrowUp } from "lucide-react";
import { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function TripPrompt() {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

          <form onSubmit={handleSubmit} className="relative">
            <label htmlFor="trip-prompt" className="sr-only">
              Describe your trip
            </label>
            <Textarea
              id="trip-prompt"
              name="trip-prompt"
              placeholder="A solo 7-day trip to Osaka in August..."
              rows={5}
              className="resize-none rounded-2xl border-border-default bg-bg-surface pr-12 text-text-primary placeholder:text-text-faint"
            />
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Submit trip prompt"
              className="absolute right-3 bottom-3 rounded-full"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
