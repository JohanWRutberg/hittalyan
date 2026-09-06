import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCurrentMarket } from "@/lib/market-context";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.pages");
  return { title: t("register") };
}

export default async function RegisterPage() {
  // Har besökaren tittat på en viss kö som utloggad är den förvald här.
  return <RegisterForm initialMarket={await getCurrentMarket()} />;
}
