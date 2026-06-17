import NextAuth from "next-auth";
import { createAuthConfig } from "@/lib/auth-config";

export const {
  handlers,
  auth: codingAuth,
  signIn: codingSignIn,
  signOut: codingSignOut,
} = NextAuth(createAuthConfig("coding"));

export const { GET, POST } = handlers;
