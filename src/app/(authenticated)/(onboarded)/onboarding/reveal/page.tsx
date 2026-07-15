import { PageShell } from "@/components/app-shell";
import { Reveal } from "@/app/onboarding/reveal/reveal";
import { prisma } from "@/db/client";
import { getSession } from "@/server/session";

// The "reveal" (BUILD.md §8 step 7). A data-driven dashboard that contrasts objective
// signals with common self-bias (gracefully defuses Dunning-Kruger). M4 ships the
// scaffold: it surfaces the behavioural calibration estimate honestly; game-feature
// interpretation (Seam 3) lands with analysis (M5) and the program engine (M6).
export default async function RevealPage() {
  const session = await getSession();
  if (!session?.user) return null;
  await prisma.user.updateMany({
    where: { id: session.user.id, setupRevealSeenAt: null },
    data: { setupRevealSeenAt: new Date() },
  });

  return (
    <PageShell
      eyebrow="Step 4 of setup"
      title="Where you stand"
      lede="Built from what you do, not what you say. Mainline never overstates how strong the evidence is."
      width="wide"
    >
      <Reveal />
    </PageShell>
  );
}
