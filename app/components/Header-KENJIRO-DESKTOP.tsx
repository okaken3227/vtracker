import Link from "next/link";
import RefreshButton from "./RefreshButton";
import NavDrawer from "./NavDrawer";

export default function Header() {
  return (
    <header className="relative z-20 shrink-0 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
          v<span className="text-violet-600">tracker</span>
        </Link>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <NavDrawer />
        </div>
      </div>
    </header>
  );
}
