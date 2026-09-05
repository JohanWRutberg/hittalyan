"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient(), emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
