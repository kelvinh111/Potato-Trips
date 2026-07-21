import { AppHeader } from "@/components/app/app-header";
import { TripPrompt } from "@/components/home/trip-prompt";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-bg-base">
      <AppHeader />
      <main className="flex flex-1">
        <TripPrompt />
      </main>
    </div>
  );
}
