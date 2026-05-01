"use client";

import { useEffect, useState } from "react";

const rememberedEmailKey = "scadacom.rememberedEmail";
const bossEmail = "boss@telecom.local";

export function LoginFields() {
  const [remember, setRemember] = useState(false);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(rememberedEmailKey);
    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
  }, []);

  return (
    <>
      <label className="block text-sm font-medium text-ink">
        Email
        <input
          autoComplete="email"
          className="focus-ring mt-2 w-full rounded-md border border-stone-300 px-3 py-3"
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            const value = event.target.value;
            setEmail(value);
            if (remember) window.localStorage.setItem(rememberedEmailKey, value);
          }}
          required
        />
      </label>
      <button
        className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-stone-700"
        type="button"
        onClick={() => {
          setEmail(bossEmail);
          if (remember) window.localStorage.setItem(rememberedEmailKey, bossEmail);
        }}
      >
        Fill boss email
      </button>
      <label className="block text-sm font-medium text-ink">
        Password
        <input autoComplete="current-password" className="focus-ring mt-2 w-full rounded-md border border-stone-300 px-3 py-3" name="password" type={showPassword ? "text" : "password"} required />
      </label>
      <label className="flex items-center gap-3 text-sm font-medium text-stone-700">
        <input className="h-4 w-4 rounded border-stone-300" type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
        Show password while typing
      </label>
      <label className="flex items-center gap-3 text-sm font-medium text-stone-700">
        <input
          className="h-4 w-4 rounded border-stone-300"
          name="remember"
          type="checkbox"
          checked={remember}
          onChange={(event) => {
            const checked = event.target.checked;
            setRemember(checked);
            if (checked && email) window.localStorage.setItem(rememberedEmailKey, email);
            if (!checked) window.localStorage.removeItem(rememberedEmailKey);
          }}
        />
        Keep me signed in on this device
      </label>
    </>
  );
}
