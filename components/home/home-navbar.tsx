"use client";

import {
  useAuth,
  SignInButton,
  SignUpButton,
  useClerk,
  useUser,
} from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function UserAvatarFallback({ initials }: { initials: string }) {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent-primary-dim text-xs font-semibold text-text-primary">
      {initials}
    </span>
  );
}

export function HomeNavbar() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() ||
    user?.username?.slice(0, 2).toUpperCase() ||
    user?.primaryEmailAddress?.emailAddress?.slice(0, 2).toUpperCase() ||
    "U";

  return (
    <header className="w-full border-b border-border-default/70 bg-bg-base">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="text-sm font-semibold tracking-wide text-text-primary sm:text-base">
          Potato Trips
        </div>

        {isSignedIn === false && (
          <div className="flex items-center gap-2 sm:gap-3">
            <SignInButton mode="modal">
              <Button type="button" variant="ghost" className="rounded-xl">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button type="button" className="rounded-xl">
                Sign Up
              </Button>
            </SignUpButton>
          </div>
        )}

        {isSignedIn && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full p-0"
                  aria-label="Open account menu"
                />
              }
            >
              {user?.hasImage && user.imageUrl ? (
                <span
                  aria-label="User avatar"
                  className="inline-flex size-8 rounded-full border border-border-default bg-cover bg-center"
                  style={{ backgroundImage: `url(${user.imageUrl})` }}
                />
              ) : (
                <UserAvatarFallback initials={initials} />
              )}
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44 rounded-2xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem disabled aria-disabled="true">
                  My Trips
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => clerk.openUserProfile()}>
                  Profile
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => clerk.signOut()}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
