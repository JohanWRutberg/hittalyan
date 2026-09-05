import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="card w-full max-w-md p-8">{children}</div>
    </div>
  );
}
