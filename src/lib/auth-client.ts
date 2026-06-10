import { createAuthClient } from "better-auth/react"
import { twoFactorClient, usernameClient } from "better-auth/client/plugins"
import { passkeyClient } from "@better-auth/passkey/client"

// When a sign-in answers with twoFactorRedirect, the login page must switch to
// its TOTP step in place (an SPA has no /two-factor page to navigate to). The
// page registers its handler here; module scope because the auth client is
// created once, outside React.
let twoFactorHandler: (() => void) | undefined
export function setTwoFactorHandler(handler: (() => void) | undefined) {
  twoFactorHandler = handler
}

// Auth requests go through the same Vite proxy as the rest of the API, so
// session cookies are bound to the SPA origin.
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/agent/auth`,
  plugins: [
    usernameClient(),
    twoFactorClient({ onTwoFactorRedirect: () => twoFactorHandler?.() }),
    passkeyClient(),
  ],
})

export type Session = typeof authClient.$Infer.Session
