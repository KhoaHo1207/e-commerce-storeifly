import { prisma } from "../config/prisma.js";

export interface NeonUserRecord {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  createdAt?: Date | null;
}

const USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const selectById = async (id: string): Promise<NeonUserRecord | null> => {
  const rows = await prisma.$queryRaw<NeonUserRecord[]>`
    SELECT id, name, email, role, "createdAt"
    FROM neon_auth."user"
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
};

const selectByEmail = async (email: string): Promise<NeonUserRecord | null> => {
  const rows = await prisma.$queryRaw<NeonUserRecord[]>`
    SELECT id, name, email, role, "createdAt"
    FROM neon_auth."user"
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  return rows[0] ?? null;
};

export const findNeonUser = async (filter: {
  id?: string;
  email?: string;
}): Promise<NeonUserRecord | null> => {
  if (filter.id && USER_ID.test(filter.id)) {
    const byId = await selectById(filter.id);
    if (byId) {
      return byId;
    }
  }

  if (filter.email) {
    return selectByEmail(filter.email);
  }

  return null;
};
