import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** DB users.id */
    dbUserId?: string;
    role?: "USER" | "ADMIN";
    provider?: "credentials" | "github" | "google";
    oauthImage?: string | null;
    rememberLogin?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      provider?: "credentials" | "github" | "google";
      oauthImage?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "USER" | "ADMIN";
    provider?: "credentials" | "github" | "google";
    oauthImage?: string | null;
    authExpiresAt?: number;
  }
}
