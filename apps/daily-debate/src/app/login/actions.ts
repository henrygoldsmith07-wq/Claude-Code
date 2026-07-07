"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn as authSignIn, signOut as authSignOut } from "@/lib/auth";
import { registerUser } from "@/lib/db/users";

export interface AuthState {
  error: string | null;
}

export async function signIn(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await authSignIn("credentials", {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid email or password." };
    throw error;
  }
  return { error: null };
}

export async function signUp(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const displayName = String(formData.get("displayName") || "");

  try {
    await registerUser({ email, password, displayName });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create account." };
  }

  try {
    await authSignIn("credentials", { email, password, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created — please sign in." };
    throw error;
  }
  return { error: null };
}

export async function signOutAction() {
  await authSignOut({ redirectTo: "/login" });
  revalidatePath("/", "layout");
  redirect("/login");
}
