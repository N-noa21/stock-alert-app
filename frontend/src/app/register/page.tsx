"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type RegisterResponse = {
  user: {
    id: number;
    email: string;
    name: string | null;
  };
  token: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("user1");
  const [email, setEmail] = useState("user1@example.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);
    setIsLoading(true);

    try {
      const data = await apiFetch<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      
      localStorage.setItem("token", data.token);
      
      router.push("/stocks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">アカウント登録</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">名前</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            メールアドレス
          </label>
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
          {isLoading ? "登録中..." : "登録"}
        </button>
      </form>

      <p className="mt-4 text-sm">
        すでにアカウントがある場合は{" "}
        <Link href="/login" className="text-blue-600 underline">
          ログイン
        </Link>
      </p>
    </main>
  );
}