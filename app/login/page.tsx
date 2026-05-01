import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, auth } from "@/auth";
import { LoginFields } from "@/components/login-fields";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const session = await auth();
  if (session) redirect("/dashboard");
  const params = await searchParams;
  const redirectTo = safeRedirectPath(params.callbackUrl);

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo
      });
    } catch (error) {
      if (error instanceof AuthError && error.type === "CredentialsSignin") {
        redirect("/login?error=CredentialsSignin");
      }
      throw error;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-field px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-8 shadow-soft">
        <div className="mb-8">
          <img src="/scadacom-logo.png" alt="ScadaCom" className="h-20 w-auto rounded-md object-contain" />
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-mint">Internal access</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">ScadaCom ERP</h1>
          <p className="mt-2 text-sm text-stone-600">Secure operations platform for projects, cash, teams, and profitability.</p>
        </div>
        <form action={login} className="space-y-4">
          {params.error === "CredentialsSignin" ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Email or password is incorrect.</p>
          ) : null}
          <LoginFields />
          <button className="focus-ring w-full rounded-md bg-ink px-4 py-3 font-semibold text-white" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}

function safeRedirectPath(callbackUrl?: string) {
  if (!callbackUrl) return "/dashboard";
  if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) return callbackUrl;
  try {
    const url = new URL(callbackUrl);
    return url.pathname.startsWith("/_next") || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|webmanifest|js|css)$/i) ? "/dashboard" : `${url.pathname}${url.search}`;
  } catch {
    return "/dashboard";
  }
}
