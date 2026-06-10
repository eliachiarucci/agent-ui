import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Fingerprint, LogOut, ShieldCheck, ShieldOff, Trash2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { authClient } from "@/lib/auth-client"

type PasskeyEntry = { id: string; name?: string | null; createdAt?: Date | string }

export function AccountSettings() {
  const { data: session } = authClient.useSession()

  return (
    <div className="grid gap-4">
      <ChangePassword />
      <Separator />
      <TwoFactorSection twoFactorEnabled={session?.user.twoFactorEnabled ?? false} />
      <Separator />
      <PasskeySection />
      <Separator />
      <Button
        variant="outline"
        className="gap-2 justify-self-start"
        onClick={() => void authClient.signOut()}
      >
        <LogOut className="size-4" />
        Sign out{session ? ` (${session.user.name})` : ""}
      </Button>
    </div>
  )
}

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (error) {
        toast.error(error.message ?? "Failed to change password")
        return
      }
      toast.success("Password changed")
      setCurrentPassword("")
      setNewPassword("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-2" onSubmit={submit}>
      <Label>Change password</Label>
      <Input
        type="password"
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <Input
        type="password"
        placeholder="New password (min. 8 characters)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button
        type="submit"
        variant="outline"
        className="justify-self-start"
        disabled={busy || !currentPassword || !newPassword}
      >
        Update password
      </Button>
    </form>
  )
}

// Enable flow is two-step: enable() stores the secret and returns the otpauth
// URI + backup codes, but twoFactorEnabled only flips after verifyTotp confirms
// the authenticator was actually set up.
function TwoFactorSection({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null)
  const [code, setCode] = useState("")

  const enable = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data, error } = await authClient.twoFactor.enable({ password })
      if (error || !data) {
        toast.error(error?.message ?? "Failed to enable 2FA")
        return
      }
      setSetup(data)
      setPassword("")
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code })
      if (error) {
        toast.error(error.message ?? "Invalid code")
        return
      }
      toast.success("Two-factor authentication enabled")
      setSetup(null)
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  const disable = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await authClient.twoFactor.disable({ password })
      if (error) {
        toast.error(error.message ?? "Failed to disable 2FA")
        return
      }
      toast.success("Two-factor authentication disabled")
      setPassword("")
    } finally {
      setBusy(false)
    }
  }

  if (setup) {
    return (
      <form className="grid gap-2" onSubmit={confirm}>
        <Label>Finish two-factor setup</Label>
        <p className="text-xs text-muted-foreground">
          Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.
        </p>
        <div className="justify-self-center rounded-md bg-white p-3">
          <QRCodeSVG value={setup.totpURI} size={160} />
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Backup codes (store these safely)</summary>
          <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 font-mono">
            {setup.backupCodes.join("\n")}
          </pre>
        </details>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !code}>
            Confirm
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <form className="grid gap-2" onSubmit={twoFactorEnabled ? disable : enable}>
      <Label className="flex items-center gap-2">
        {twoFactorEnabled ? <ShieldCheck className="size-4 text-primary" /> : <ShieldOff className="size-4" />}
        Two-factor authentication (TOTP)
        <span className="text-xs font-normal text-muted-foreground">
          {twoFactorEnabled ? "enabled" : "disabled"}
        </span>
      </Label>
      <p className="text-xs text-muted-foreground">
        {twoFactorEnabled
          ? "Enter your password to turn off authenticator codes."
          : "Adds a 6-digit code from an authenticator app at sign-in. Confirm with your password."}
      </p>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" variant="outline" disabled={busy || !password}>
          {twoFactorEnabled ? "Disable" : "Enable"}
        </Button>
      </div>
    </form>
  )
}

function PasskeySection() {
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const { data } = await authClient.passkey.listUserPasskeys()
    setPasskeys(data ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const add = async () => {
    setBusy(true)
    try {
      const result = await authClient.passkey.addPasskey()
      if (result?.error) {
        toast.error(result.error.message ?? "Failed to add passkey")
        return
      }
      toast.success("Passkey added")
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const { error } = await authClient.passkey.deletePasskey({ id })
    if (error) {
      toast.error(error.message ?? "Failed to remove passkey")
      return
    }
    await refresh()
  }

  return (
    <div className="grid gap-2">
      <Label className="flex items-center gap-2">
        <Fingerprint className="size-4" />
        Passkeys
      </Label>
      <p className="text-xs text-muted-foreground">
        Sign in with Touch ID, your phone, or a physical security key — no password needed.
      </p>
      {passkeys.length > 0 && (
        <ul className="grid gap-1">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{pk.name || "Unnamed passkey"}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-destructive"
                aria-label="Remove passkey"
                onClick={() => void remove(pk.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" className="justify-self-start gap-2" disabled={busy} onClick={() => void add()}>
        <Fingerprint className="size-4" />
        Add a passkey
      </Button>
    </div>
  )
}
