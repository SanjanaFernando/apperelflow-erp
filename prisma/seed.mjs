import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../package.json", import.meta.url));
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*["']?(.*?)["']?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const resetDemo = process.argv.includes("--reset-demo");

const users = [
  [
    "u-cutting-supervisor",
    "supervisor@apparelflow.demo",
    "cutting_supervisor",
    "Ava Chen",
    "Supervisor#2026",
  ],
  [
    "u-cutting-verifier",
    "verifier@apparelflow.demo",
    "cutting_verifier",
    "Milo Ortiz",
    "Verifier#2026",
  ],
  [
    "u-sewing-supervisor",
    "sewing@apparelflow.demo",
    "sewing_supervisor",
    "Nia Patel",
    "Sewing#2026",
  ],
];

const recipes = [
  {
    id: "rec-bl01",
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Topwear",
    stdFabricYards: 1.8,
    wastageCap: 5,
    components: [
      ["cmp-bl01-front", "Front Body", 1],
      ["cmp-bl01-back", "Back Body", 1],
      ["cmp-bl01-sleeves", "Sleeves", 2],
      ["cmp-bl01-collar", "Collar & Stand", 1],
      ["cmp-bl01-cuffs", "Cuffs", 2],
    ],
  },
  {
    id: "rec-ct02",
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Topwear",
    stdFabricYards: 1.1,
    wastageCap: 8,
    components: [
      ["cmp-ct02-front", "Front Chest", 1],
      ["cmp-ct02-back", "Back Support", 1],
      ["cmp-ct02-neck", "Neck Binding", 1],
      ["cmp-ct02-hem", "Hem Elastic Casing", 1],
      ["cmp-ct02-side", "Side Strap Accents", 2],
    ],
  },
];

for (const [id, email, role, fullName, password] of users) {
  await prisma.user.upsert({
    where: { email },
    update: { role, fullName, passwordHash: await bcrypt.hash(password, 12) },
    create: {
      id,
      email,
      role,
      fullName,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
}

for (const recipe of recipes) {
  await prisma.recipe.upsert({
    where: { recipeCode: recipe.recipeCode },
    update: {
      name: recipe.name,
      category: recipe.category,
      stdFabricYards: recipe.stdFabricYards,
      wastageCap: recipe.wastageCap,
    },
    create: {
      id: recipe.id,
      recipeCode: recipe.recipeCode,
      name: recipe.name,
      category: recipe.category,
      stdFabricYards: recipe.stdFabricYards,
      wastageCap: recipe.wastageCap,
      components: {
        create: recipe.components.map(
          ([id, componentName, piecesPerGarment]) => ({
            id,
            componentName,
            piecesPerGarment,
          }),
        ),
      },
    },
  });
}

if (resetDemo) {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "OrderEvent" DISABLE TRIGGER "OrderEvent_immutable"',
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "VerificationLog" DISABLE TRIGGER "VerificationLog_immutable"',
  );
  try {
    await prisma.orderEvent.deleteMany();
    await prisma.verificationLog.deleteMany();
    await prisma.verificationItem.deleteMany();
    await prisma.cuttingOrder.deleteMany();
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "OrderEvent" ENABLE TRIGGER "OrderEvent_immutable"',
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "VerificationLog" ENABLE TRIGGER "VerificationLog_immutable"',
    );
  }
  console.log("Existing order workflow data cleared for demo seeding.");
}

const existingOrderCount = await prisma.cuttingOrder.count();
if (existingOrderCount === 0) {
  const blouseComponents = await prisma.recipeComponent.findMany({
    where: { recipeId: "rec-bl01" },
    orderBy: { id: "asc" },
  });
  const verifierId = "u-cutting-verifier";
  const now = new Date();
  const demoOrders = [
    ...Array.from({ length: 18 }, (_, index) => ({
      status: "CUTTING_IN_PROGRESS",
      rejectionCount: 0,
      index,
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      status: "PENDING_VERIFICATION",
      rejectionCount: 0,
      index: index + 18,
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      status: "REJECTED",
      rejectionCount: 1,
      index: index + 23,
    })),
    ...Array.from({ length: 12 }, (_, index) => ({
      status: "VERIFIED",
      rejectionCount: 0,
      index: index + 25,
    })),
  ];

  for (const demoOrder of demoOrders) {
    const targetQty = 50;
    const orderNo = `CUT-2026-DEMO-${String(demoOrder.index + 1).padStart(3, "0")}`;
    const items = blouseComponents.map((component) => {
      const expectedQty = targetQty * component.piecesPerGarment;
      const isRejected = demoOrder.status === "REJECTED";
      return {
        componentId: component.id,
        expectedQty,
        actualQty:
          demoOrder.status === "VERIFIED"
            ? expectedQty
            : isRejected
              ? Math.max(0, expectedQty - 2)
              : null,
        status:
          demoOrder.status === "VERIFIED" ? "GREEN" : isRejected ? "RED" : null,
      };
    });
    const events = [
      {
        fromStatus: null,
        toStatus: "CUTTING_IN_PROGRESS",
        actorId: "u-cutting-supervisor",
      },
    ];
    if (demoOrder.status !== "CUTTING_IN_PROGRESS") {
      events.push({
        fromStatus: "CUTTING_IN_PROGRESS",
        toStatus: "PENDING_VERIFICATION",
        actorId: "u-cutting-supervisor",
      });
    }
    if (demoOrder.status === "REJECTED") {
      events.push({
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "REJECTED",
        actorId: verifierId,
      });
    }
    if (demoOrder.status === "VERIFIED") {
      events.push({
        fromStatus: "PENDING_VERIFICATION",
        toStatus: "VERIFIED",
        actorId: verifierId,
      });
    }

    await prisma.cuttingOrder.create({
      data: {
        orderNo,
        recipeId: "rec-bl01",
        createdById: "u-cutting-supervisor",
        targetQty,
        fabricRollId: `ROLL-DEMO-${String(demoOrder.index + 1).padStart(3, "0")}`,
        actualFabricYds: 90,
        status: demoOrder.status,
        rejectionCount: demoOrder.rejectionCount,
        submittedAt: demoOrder.status === "CUTTING_IN_PROGRESS" ? null : now,
        items: { create: items },
        events: { create: events },
        logs:
          demoOrder.status === "VERIFIED"
            ? {
                create: {
                  verifierId,
                  decision: "APPROVED",
                  wastagePct: 0,
                  expectedFabricYds: 90,
                  actualFabricYds: 90,
                  componentVariances: [],
                  timestamp: now,
                },
              }
            : demoOrder.status === "REJECTED"
              ? {
                  create: {
                    verifierId,
                    decision: "REJECTED",
                    rejectionNote: "Sleeves are short and require recutting.",
                    wastagePct: 0,
                    expectedFabricYds: 90,
                    actualFabricYds: 90,
                    componentVariances: [],
                    timestamp: now,
                  },
                }
              : undefined,
      },
    });
  }
  console.log(
    "Demo order portfolio seeded: 18 cutting, 5 QC, 2 rejected, 12 verified.",
  );
}

console.log("ApparelFlow seed complete.");
await prisma.$disconnect();
