import { redirect } from "next/navigation";

// Progress page removed — the app focuses on the process (Today), not the result.
// Redirect any old bookmarks to Today.
export default function ProgressPage() {
  redirect("/today");
}
