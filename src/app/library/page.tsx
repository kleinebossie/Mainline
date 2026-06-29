import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { Library } from "@/app/library/library-view";

// The "Library" screen (BUILD.md M14 · §4.2–4.4). Auth-gated. The deliberately-external layer:
// band-appropriate book/course recommendations (graded, low-band overload books blocked), the
// book-study protocol (active recall, the 85% rule, Woodpecker cycles), and the 2D/3D modality
// + over-the-board calibration — gated by the user's play medium. Nothing is hosted; sessions
// are logged here and feed the same adaptation loop as every in-app outcome.
export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <PageShell
      eyebrow="Books, courses & over-the-board"
      title="Library"
      lede="The parts of training we keep deliberately external — recommended, never hosted. Study them the right way, log what you do, and the rest of your plan adapts around it."
    >
      <Library />
    </PageShell>
  );
}
