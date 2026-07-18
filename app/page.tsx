import { HomeNavbar } from "@/components/home/home-navbar";
import { TripPrompt } from "@/components/home/trip-prompt";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-bg-base">
      <HomeNavbar />
      <main className="flex flex-1">
        <TripPrompt />
      </main>
    </div>
  );
}
