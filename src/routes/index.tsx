import { createFileRoute } from "@tanstack/react-router";
import { HarambeGame } from "@/components/HarambeGame";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <HarambeGame />;
}
