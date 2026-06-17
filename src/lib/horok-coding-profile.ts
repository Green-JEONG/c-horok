import { auth } from "@/app/api/auth/[...nextauth]/route";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

let horokCodingSchemaPromise: Promise<void> | null = null;
let horokLogSchemaPromise: Promise<void> | null = null;

export type PlatformProfileKind = "log" | "coding";

async function getCurrentPlatformAuthUser(platform: PlatformProfileKind) {
  const session = await (platform === "coding" ? codingAuth() : auth());

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    name: user.name,
    image: user.image,
    email: user.email,
  };
}

export async function ensureHorokCodingSchema() {
  if (!horokCodingSchemaPromise) {
    horokCodingSchemaPromise = prisma
      .$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS horok_coding`)
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS horok_coding.members (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
            nickname VARCHAR(50),
            avatar_url VARCHAR(512),
            tier VARCHAR(30),
            rating INTEGER NOT NULL DEFAULT 0,
            solved_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS horok_coding.problem_progress (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            problem_slug VARCHAR(120) NOT NULL,
            problem_number INTEGER,
            status VARCHAR(20) NOT NULL DEFAULT 'not_started',
            last_language VARCHAR(20),
            last_code TEXT,
            last_submitted_at TIMESTAMPTZ,
            solved_at TIMESTAMPTZ,
            solved_duration_seconds INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, problem_slug)
          )
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS horok_coding.submissions (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            problem_slug VARCHAR(120) NOT NULL,
            problem_number INTEGER,
            language VARCHAR(20) NOT NULL,
            source_code TEXT NOT NULL,
            output TEXT,
            expected_output TEXT,
            status VARCHAR(20) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS horok_coding.saved_codes (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            problem_slug VARCHAR(120) NOT NULL,
            problem_number INTEGER,
            language VARCHAR(20) NOT NULL,
            source_code TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, problem_slug, language)
          )
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          ALTER TABLE horok_coding.members
          ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          ALTER TABLE horok_coding.problem_progress
          ADD COLUMN IF NOT EXISTS solved_duration_seconds INTEGER
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          ALTER TABLE horok_coding.submissions
          ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER
        `),
      )
      .then(() => undefined);
  }

  return horokCodingSchemaPromise;
}

async function ensureHorokLogSchema() {
  if (!horokLogSchemaPromise) {
    horokLogSchemaPromise = prisma
      .$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS horok_log`)
      .then(() =>
        prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS horok_log.members (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
            display_name VARCHAR(100),
            avatar_url VARCHAR(512),
            bio VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `),
      )
      .then(() =>
        prisma.$executeRawUnsafe(`
          ALTER TABLE horok_log.members
          ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
          ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512),
          ADD COLUMN IF NOT EXISTS bio VARCHAR(255)
        `),
      )
      .then(() => undefined);
  }

  return horokLogSchemaPromise;
}

export async function ensureHorokCodingMemberProfile() {
  const currentUser = await getCurrentPlatformAuthUser("coding");

  if (!currentUser) {
    return null;
  }

  await ensureHorokCodingSchema();

  const rows = await prisma.$queryRaw<Array<{ id: bigint; user_id: bigint }>>`
    INSERT INTO horok_coding.members (user_id, nickname, avatar_url)
    VALUES (${currentUser.userId}, ${currentUser.name}, ${currentUser.image})
    ON CONFLICT (user_id) DO UPDATE
    SET
      nickname = EXCLUDED.nickname,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    RETURNING id, user_id
  `;

  return rows[0]
    ? {
        id: rows[0].id.toString(),
        userId: rows[0].user_id.toString(),
      }
    : null;
}

export async function ensureHorokLogMemberProfile() {
  const currentUser = await getCurrentPlatformAuthUser("log");

  if (!currentUser) {
    return null;
  }

  await ensureHorokLogSchema();

  const rows = await prisma.$queryRaw<
    Array<{ id: bigint; user_id: bigint; display_name: string | null }>
  >`
    INSERT INTO horok_log.members (user_id, display_name, avatar_url)
    VALUES (${currentUser.userId}, ${currentUser.name}, ${currentUser.image})
    ON CONFLICT (user_id) DO UPDATE
    SET
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    RETURNING id, user_id, display_name
  `;

  return rows[0]
    ? {
        id: rows[0].id.toString(),
        userId: rows[0].user_id.toString(),
        displayName: rows[0].display_name,
      }
    : null;
}

export async function getCurrentPlatformProfile(platform: PlatformProfileKind) {
  const currentUser = await getCurrentPlatformAuthUser(platform);

  if (!currentUser) {
    return null;
  }

  if (platform === "coding") {
    await ensureHorokCodingMemberProfile();

    const member = await prisma.codingMember.findUnique({
      where: { userId: currentUser.userId },
      select: {
        nickname: true,
        avatarUrl: true,
      },
    });

    return {
      platform,
      name: currentUser.name ?? member?.nickname,
      image: currentUser.image ?? member?.avatarUrl,
      email: currentUser.email,
    };
  }

  await ensureHorokLogMemberProfile();

  const member = await prisma.logMember.findUnique({
    where: { userId: currentUser.userId },
    select: {
      displayName: true,
      avatarUrl: true,
    },
  });

  return {
    platform,
    name: currentUser.name ?? member?.displayName,
    image: currentUser.image ?? member?.avatarUrl,
    email: currentUser.email,
  };
}

async function syncSharedPlatformProfiles(
  userId: bigint,
  data: {
    name?: string;
    image?: string | null;
  },
) {
  await Promise.all([ensureHorokLogSchema(), ensureHorokCodingSchema()]);

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.image !== undefined ? { image: data.image } : {}),
    },
  });

  await Promise.all([
    prisma.logMember.upsert({
      where: { userId },
      create: {
        userId,
        displayName: data.name,
        avatarUrl: data.image,
      },
      update: {
        ...(data.name !== undefined ? { displayName: data.name } : {}),
        ...(data.image !== undefined ? { avatarUrl: data.image } : {}),
      },
      select: { id: true },
    }),
    prisma.codingMember.upsert({
      where: { userId },
      create: {
        userId,
        nickname: data.name,
        avatarUrl: data.image,
      },
      update: {
        ...(data.name !== undefined ? { nickname: data.name } : {}),
        ...(data.image !== undefined ? { avatarUrl: data.image } : {}),
      },
      select: { id: true },
    }),
  ]);
}

export async function updateCurrentPlatformProfile(
  platform: PlatformProfileKind,
  data: {
    name?: string;
    image?: string | null;
  },
) {
  const currentUser = await getCurrentPlatformAuthUser(platform);

  if (!currentUser) {
    return null;
  }

  const hasProfileChanges = data.name !== undefined || data.image !== undefined;

  if (hasProfileChanges) {
    await syncSharedPlatformProfiles(currentUser.userId, data);
  } else if (platform === "coding") {
    await ensureHorokCodingMemberProfile();
  } else {
    await ensureHorokLogMemberProfile();
  }

  if (platform === "coding") {
    const member = await prisma.codingMember.findUnique({
      where: { userId: currentUser.userId },
      select: {
        nickname: true,
        avatarUrl: true,
      },
    });

    return {
      name: member?.nickname ?? currentUser.name,
      image:
        data.image !== undefined
          ? data.image
          : (member?.avatarUrl ?? currentUser.image),
    };
  }

  const member = await prisma.logMember.findUnique({
    where: { userId: currentUser.userId },
    select: {
      displayName: true,
      avatarUrl: true,
    },
  });

  return {
    name: member?.displayName ?? data.name ?? currentUser.name,
    image:
      data.image !== undefined
        ? data.image
        : (member?.avatarUrl ?? currentUser.image),
  };
}

export async function checkPlatformNicknameAvailability(
  _platform: PlatformProfileKind,
  name: string,
  excludeUserId?: string,
) {
  const excludeId =
    excludeUserId && /^\d+$/.test(excludeUserId) ? BigInt(excludeUserId) : null;
  const user = await prisma.user.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (user) {
    return { available: false, message: "이미 사용 중인 닉네임입니다." };
  }

  await Promise.all([ensureHorokLogSchema(), ensureHorokCodingSchema()]);

  const [logMember, codingMember] = await Promise.all([
    prisma.logMember.findFirst({
      where: {
        displayName: { equals: name, mode: "insensitive" },
        ...(excludeId ? { NOT: { userId: excludeId } } : {}),
      },
      select: { id: true },
    }),
    prisma.codingMember.findFirst({
      where: {
        nickname: { equals: name, mode: "insensitive" },
        ...(excludeId ? { NOT: { userId: excludeId } } : {}),
      },
      select: { id: true },
    }),
  ]);

  return logMember || codingMember
    ? { available: false, message: "이미 사용 중인 닉네임입니다." }
    : { available: true, message: "사용 가능한 닉네임입니다." };
}
