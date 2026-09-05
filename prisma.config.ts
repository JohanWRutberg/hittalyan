import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migreringar (Prisma CLI) ska gå mot en direkt anslutning, inte via Neons pooler.
// Neons Vercel-integration sätter DATABASE_URL (pooled) och DATABASE_URL_UNPOOLED.
// Runtime (src/lib/prisma.ts) använder alltid DATABASE_URL.
// Vid `prisma generate` (postinstall) behövs ingen riktig databas, så vi faller
// tillbaka på en platshållare i stället för att krascha en färsk installation.
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
