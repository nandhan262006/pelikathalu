"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@/app/admin/dashboard.css";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin/home";
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (r.ok) {
      router.replace(next);
      router.refresh();
    } else {
      setErr("Wrong password — try again.");
    }
  };

  return (
    <main className="db-login">
      <form className="db-login-card" onSubmit={submit}>
        <h1>Pelli Kathalu</h1>
        <p>Site dashboard — enter the studio password to edit content.</p>
        <label className="db-field">
          <span className="db-label">Password</span>
          <input
            className="db-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {err && <span className="db-login-err">{err}</span>}
        <button type="submit" className="db-btn db-btn-primary" disabled={busy || !password}>
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="db-center">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
