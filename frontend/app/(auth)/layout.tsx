import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="relative w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-[#FF6F5C]" />
          <div className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full bg-[#F2C14E] border-2 border-background" />
        </div>
        <div>
          <div className="font-semibold text-2xl text-primary leading-none">BuyWise</div>
          <div className="text-xs text-secondary mt-1">Every rupee, a job.</div>
        </div>
      </Link>
      {children}
    </div>
  );
}
