"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

type LoginResponse = {
  user: {
    id: number;
    email: string;
    name: string | null;
  };
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("user1@example.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);
    setIsLoading(true);

    try {
      await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      router.push("/stocks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">ログイン</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">メールアドレス</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">パスワード</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        アカウントがない場合は{" "}
        <Link href="/register" className="text-blue-600 underline">
          新規登録
        </Link>
      </p>
    </main>
  );
}