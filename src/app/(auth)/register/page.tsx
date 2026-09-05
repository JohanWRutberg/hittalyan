import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Skapa konto" };

export default function RegisterPage() {
  return <RegisterForm />;
}
