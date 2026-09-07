import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />
          <LocaleSwitcher />
        </div>
      </div>
      <div className="card w-full max-w-md p-8">{children}</div>
    </div>
  );
}
