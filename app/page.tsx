import { HomeNavbar } from "@/components/home/home-navbar";
import { TripPrompt } from "@/components/home/trip-prompt";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col overflow-x-hidden bg-bg-base">
      <HomeNavbar />
      <TripPrompt />
    </main>
  );
}
