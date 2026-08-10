import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chaz Crestview Academy" },
      { name: "description", content: "For Premium Education — all-in-one school management system." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Navigate to="/dashboard" />;
}
