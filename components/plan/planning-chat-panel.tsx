import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PlanningChatPanel() {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border-default bg-bg-surface shadow-sm">
      <header className="border-b border-border-subtle px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-text-primary">Planning Chat</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-border-subtle bg-bg-subtle/50 px-5 text-center">
          <p className="max-w-sm text-sm text-text-secondary">
            Conversation will appear here after planning starts.
          </p>
        </div>
      </div>

      <div className="border-t border-border-subtle px-4 py-4 sm:px-5">
        <label htmlFor="planning-chat-message" className="sr-only">
          Message composer
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id="planning-chat-message"
            name="planning-chat-message"
            rows={2}
            disabled
            placeholder="Ask a follow-up question"
            className="resize-none rounded-2xl border-border-default bg-bg-surface text-text-primary placeholder:text-text-faint"
          />
          <Button
            type="button"
            size="icon-sm"
            disabled
            aria-label="Send message"
            className="rounded-full"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}