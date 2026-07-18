import { Button } from "@/components/ui/button";

export function HomeNavbar() {
  return (
    <header className="w-full border-b border-border-default/70 bg-bg-base">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="text-sm font-semibold tracking-wide text-text-primary sm:text-base">
          Potato Trips
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button type="button" variant="ghost" className="rounded-xl">
            Sign In
          </Button>
          <Button type="button" className="rounded-xl">
            Sign Up
          </Button>
        </div>
      </div>
    </header>
  );
}
