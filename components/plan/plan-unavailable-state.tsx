import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlanUnavailableStateProps {
  title: string;
  description: string;
}

export function PlanUnavailableState({
  title,
  description,
}: PlanUnavailableStateProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full max-w-xl rounded-3xl border border-border-default bg-bg-surface shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl text-text-primary">{title}</CardTitle>
          <CardDescription className="text-sm text-text-secondary">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/"
            className={cn(buttonVariants(), "inline-flex rounded-xl")}
          >
            Start a New Plan
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}