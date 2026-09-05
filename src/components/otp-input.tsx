"use client";

/** Sexsiffrigt kodfält: stort, centrerat och med numeriskt tangentbord på mobil. */
export function OtpInput({ value, onChange, id = "otp" }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <input
      id={id}
      name={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      required
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="input text-center font-mono text-2xl font-bold tracking-[0.4em]"
      placeholder="——————"
    />
  );
}
