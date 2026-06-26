"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function Header() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiFetch<{ message: string }>("/auth/logout", {
        method: "POST",
      });

      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
        <Link href="/stocks" className="text-lg font-bold">
          Stock Alert App
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/stocks" className="text-gray-700 hover:underline">
            銘柄一覧
          </Link>

          <button
            onClick={handleLogout}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            ログアウト
          </button>
        </nav>
      </div>
    </header>
  );
}