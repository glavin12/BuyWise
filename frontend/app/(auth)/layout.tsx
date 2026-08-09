import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Link
        href="/"
        className="flex items-center gap-2.5 mb-8"
      >
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <span className="font-semibold text-2xl text-primary">
          BuyWise
        </span>
      </Link>
      {children}
    </div>
  );
}
