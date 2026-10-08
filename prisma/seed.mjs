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

const users = [
  ["u-cutting-supervisor", "supervisor@apparelflow.demo", "cutting_supervisor", "Ava Chen", "Supervisor#2026"],
  ["u-cutting-verifier", "verifier@apparelflow.demo", "cutting_verifier", "Milo Ortiz", "Verifier#2026"],
  ["u-sewing-supervisor", "sewing@apparelflow.demo", "sewing_supervisor", "Nia Patel", "Sewing#2026"],
];

const recipes = [
  {
    id: "rec-bl01",
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Topwear",
    stdFabricYards: 1.8,
    wastageCap: 5,
    components: [["cmp-bl01-front", "Front Body", 1], ["cmp-bl01-back", "Back Body", 1], ["cmp-bl01-sleeves", "Sleeves", 2], ["cmp-bl01-collar", "Collar & Stand", 1], ["cmp-bl01-cuffs", "Cuffs", 2]],
  },
  {
    id: "rec-ct02",
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Topwear",
    stdFabricYards: 1.1,
    wastageCap: 8,
    components: [["cmp-ct02-front", "Front Chest", 1], ["cmp-ct02-back", "Back Support", 1], ["cmp-ct02-neck", "Neck Binding", 1], ["cmp-ct02-hem", "Hem Elastic Casing", 1], ["cmp-ct02-side", "Side Strap Accents", 2]],
  },
];

for (const [id, email, role, fullName, password] of users) {
  await prisma.user.upsert({
    where: { email },
    update: { role, fullName, passwordHash: await bcrypt.hash(password, 12) },
    create: { id, email, role, fullName, passwordHash: await bcrypt.hash(password, 12) },
  });
}

for (const recipe of recipes) {
  await prisma.recipe.upsert({
    where: { recipeCode: recipe.recipeCode },
    update: { name: recipe.name, category: recipe.category, stdFabricYards: recipe.stdFabricYards, wastageCap: recipe.wastageCap },
    create: {
      id: recipe.id,
      recipeCode: recipe.recipeCode,
      name: recipe.name,
      category: recipe.category,
      stdFabricYards: recipe.stdFabricYards,
      wastageCap: recipe.wastageCap,
      components: { create: recipe.components.map(([id, componentName, piecesPerGarment]) => ({ id, componentName, piecesPerGarment })) },
    },
  });
}

console.log("ApparelFlow seed complete.");
await prisma.$disconnect();
