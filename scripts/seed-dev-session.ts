import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  const userId = "dev-user-1";
  const sessionToken = "dev-session-token-1";

  // Upsert user
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {
      betaAccessGrantedAt: new Date(),
      setupRevealSeenAt: new Date(),
    },
    create: {
      id: userId,
      name: "Dev Tester",
      email: "dev@mainline.test",
      betaAccessGrantedAt: new Date(),
      setupRevealSeenAt: new Date(),
    },
  });

  // Upsert session
  await prisma.session.upsert({
    where: { sessionToken },
    update: {
      expires: new Date(Date.now() + 30 * 86400000),
    },
    create: {
      id: "dev-session-1",
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 30 * 86400000),
    },
  });

  // Upsert assessment
  await prisma.assessment.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      completedAt: new Date(),
      calibrationResponses: [
        { ratingShown: 1200, correct: true },
        { ratingShown: 1400, correct: true },
        { ratingShown: 1600, correct: false },
      ],
      tacticalRatingEstimate: 1450,
      uncertainty: 75,
      methodologyVersion: "research-1.0.0",
    },
  });

  // Upsert current constraint set
  const constraint = await prisma.constraintSet.findFirst({
    where: { userId: user.id, isCurrent: true },
  });

  if (!constraint) {
    await prisma.constraintSet.create({
      data: {
        userId: user.id,
        minutesPerDay: 30,
        daysPerWeek: 5,
        goals: { primary: "Improve tactics and calculation" },
        formatPrefs: { bullet: false, blitz: true, rapid: true, classical: true },
        isCurrent: true,
        version: 1,
      },
    });
  }

  // Upsert platform connection
  await prisma.platformConnection.upsert({
    where: { userId_platform: { userId: user.id, platform: "lichess" } },
    update: {},
    create: {
      userId: user.id,
      platform: "lichess",
      externalUsername: "dev_lichess_user",
      status: "active",
    },
  });

  console.log("Dev session seeded successfully!");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
