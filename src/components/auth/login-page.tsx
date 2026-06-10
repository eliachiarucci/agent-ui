import { useEffect, useState, type FormEvent } from "react"
import { Fingerprint, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { authClient, setTwoFactorHandler } from "@/lib/auth-client"

type Mode = "sign-in" | "sign-up" | "totp"

// Session state is owned by authClient.useSession() in App; successful auth
// updates it and this page unmounts on its own.
export function LoginPage() {
  const [mode, setMode] = useState<Mode>("sign-in")
  const [busy, setBusy] = useState(false)

  // Accounts with 2FA answer password sign-in with a twoFactorRedirect instead
  // of a session; the client plugin calls this to switch to the code step.
  useEffect(() => {
    setTwoFactorHandler(() => setMode("totp"))
    return () => setTwoFactorHandler(undefined)
  }, [])

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")

  const run = async (fn: () => Promise<{ error?: { message?: string } | null }>) => {
    setBusy(true)
    try {
      const { error } = await fn()
      if (error) toast.error(error.message ?? "Authentication failed")
      return !error
    } finally {
      setBusy(false)
    }
  }

  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data, error } = await authClient.signIn.username({ username, password })
      if (error) {
        toast.error(error.message ?? "Sign in failed")
        return
      }
      // Accounts with TOTP enabled get a second step instead of a session.
      if (data && "twoFactorRedirect" in data) setMode("totp")
    } finally {
      setBusy(false)
    }
  }

  const verifyTotp = async (e: FormEvent) => {
    e.preventDefault()
    await run(() => authClient.twoFactor.verifyTotp({ code }))
  }

  const signUp = async (e: FormEvent) => {
    e.preventDefault()
    await run(() => authClient.signUp.email({ email, password, name, username }))
  }

  const signInWithPasskey = async () => {
    setBusy(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result?.error) toast.error(result.error.message ?? "Passkey sign in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="size-6 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-semibold">Agent</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "sign-up"
              ? "Create your account"
              : mode === "totp"
                ? "Enter the code from your authenticator app"
                : "Sign in to your account"}
          </p>
        </div>

        {mode === "sign-in" && (
          <form className="grid gap-3" onSubmit={signIn}>
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username webauthn"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              Sign in
            </Button>
            <div className="relative my-1">
              <Separator />
              <span className="absolute inset-x-0 -top-2 mx-auto w-fit bg-background px-2 text-xs text-muted-foreground">
                or
              </span>
            </div>
            <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => void signInWithPasskey()}>
              <Fingerprint className="size-4" />
              Sign in with a passkey
            </Button>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              No account?{" "}
              <button type="button" className="underline" onClick={() => setMode("sign-up")}>
                Sign up
              </button>
            </p>
          </form>
        )}

        {mode === "sign-up" && (
          <form className="grid gap-3" onSubmit={signUp}>
            <div className="grid gap-1.5">
              <Label htmlFor="su-name">Name</Label>
              <Input
                id="su-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown to people you share agents with, and how the agent refers to you.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="su-username">Username</Label>
              <Input
                id="su-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="su-email">Email</Label>
              <Input
                id="su-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="su-password">Password</Label>
              <Input
                id="su-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              Create account
            </Button>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button type="button" className="underline" onClick={() => setMode("sign-in")}>
                Sign in
              </button>
            </p>
          </form>
        )}

        {mode === "totp" && (
          <form className="grid gap-3" onSubmit={verifyTotp}>
            <div className="grid gap-1.5">
              <Label htmlFor="totp-code">One-time code</Label>
              <Input
                id="totp-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                autoFocus
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              Verify
            </Button>
            <button
              type="button"
              className="text-center text-sm text-muted-foreground underline"
              onClick={() => setMode("sign-in")}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
