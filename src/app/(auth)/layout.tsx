import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Logo />
        <LocaleSwitcher />
      </div>
      <div className="card w-full max-w-md p-8">{children}</div>
    </div>
  );
}
