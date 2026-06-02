import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { authAdapter } from "@/lib/auth-adapter";
import { findUserByEmail } from "@/lib/db";
import { getSmtpEmailConfig } from "@/lib/email";
import { env } from "@/lib/env";

const smtpEmailConfig = getSmtpEmailConfig();

type AuthPlatform = "tech" | "cote";

export function createAuthConfig(platform: AuthPlatform): NextAuthConfig {
  return {
    adapter: authAdapter,
    basePath: platform === "cote" ? "/api/cote-auth" : "/api/auth",
    session: {
      strategy: "jwt",
    },
    providers: [
      GitHub({
        allowDangerousEmailAccountLinking: true,
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      }),
      Google({
        allowDangerousEmailAccountLinking: true,
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }),
      Credentials({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email =
            typeof credentials?.email === "string"
              ? credentials.email.trim()
              : null;

          const password =
            typeof credentials?.password === "string"
              ? credentials.password
              : null;

          if (!email || !password) return null;

          const user = await findUserByEmail(email);
          if (!user || !user.password) return null;

          const ok = await bcrypt.compare(password, user.password);
          if (!ok) return null;

          return {
            id: String(user.id),
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            oauthImage: user.oauth_image ?? undefined,
            role: user.role,
            provider: user.provider,
          };
        },
      }),
      Nodemailer({
        id: "nodemailer",
        ...smtpEmailConfig,
      }),
    ],
    callbacks: {
      async signIn() {
        return true;
      },

      async jwt({ token, user, trigger, session }) {
        if (user) {
          if (typeof user.dbUserId === "string") {
            token.userId = user.dbUserId;
          } else if (typeof user.id === "string") {
            token.userId = user.id;
          }
          if (user.role === "USER" || user.role === "ADMIN") {
            token.role = user.role;
          }
          if (
            user.provider === "credentials" ||
            user.provider === "github" ||
            user.provider === "google"
          ) {
            token.provider = user.provider;
          }
          if (typeof user.name === "string") {
            token.name = user.name;
          }
          if (typeof user.image === "string") {
            token.picture = user.image;
          }
          if (typeof user.oauthImage === "string" || user.oauthImage === null) {
            token.oauthImage = user.oauthImage;
          }
        }

        if (trigger === "update") {
          if (typeof session?.name === "string") {
            token.name = session.name;
          }
          if ("image" in (session ?? {})) {
            token.picture =
              typeof session?.image === "string" ? session.image : null;
          }
        }

        if (
          typeof token.email === "string" &&
          (!token.userId ||
            token.picture === undefined ||
            token.oauthImage === undefined)
        ) {
          const dbUser = await findUserByEmail(token.email);
          if (dbUser) {
            token.userId = dbUser.id;
            token.role = dbUser.role;
            token.provider = dbUser.provider;
            token.name = dbUser.name ?? token.name;
            token.picture = dbUser.image ?? token.picture;
            token.oauthImage = dbUser.oauth_image;
          }
        }

        return token;
      },

      session({ session, token }) {
        if (session.user) {
          session.user.id = (token.userId ?? token.sub) as string;
          session.user.name =
            typeof token.name === "string" ? token.name : null;
          session.user.role = token.role as "USER" | "ADMIN";
          session.user.provider = token.provider as
            | "credentials"
            | "github"
            | "google"
            | undefined;
          session.user.image =
            typeof token.picture === "string" ? token.picture : null;
          session.user.oauthImage =
            typeof token.oauthImage === "string" || token.oauthImage === null
              ? token.oauthImage
              : null;
        }
        return session;
      },
    },
  };
}
