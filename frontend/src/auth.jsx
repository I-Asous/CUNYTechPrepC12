// Sign-in with Clerk. Signed-in players' bot games are saved to their match
// history; guests can do everything else.
//
// Set VITE_CLERK_PUBLISHABLE_KEY (in frontend/.env.local, or on the host at
// build time) to turn sign-in on. Without it the site works as before, with no
// sign-in button.

import { useEffect } from "react";
import { ClerkProvider, SignInButton, UserButton, useAuth } from "@clerk/react";

import { setTokenGetter } from "./api.js";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const authEnabled = Boolean(PUBLISHABLE_KEY);

export function AuthProvider({ children }) {
  if (!authEnabled) return children;
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <TokenBridge />
      {children}
    </ClerkProvider>
  );
}

// api.js isn't a React component, so it can't call useAuth itself. This hands
// it Clerk's getToken while someone is signed in, and takes it back on sign-out.
function TokenBridge() {
  const { isSignedIn, getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(isSignedIn ? getToken : null);
    return () => setTokenGetter(null);
  }, [isSignedIn, getToken]);
  return null;
}

// The header's account button: Sign in for guests, the Clerk profile menu
// (avatar) once signed in.
export function AccountButton() {
  return authEnabled ? <ClerkAccountButton /> : null;
}

function ClerkAccountButton() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <UserButton />;
  return (
    <SignInButton mode="modal">
      <button type="button" className="sign-in" aria-label="Sign in" title="Sign in to save your games">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="5.5" r="2.75" />
          <path d="M2.75 14C2.75 10.9 5.1 9 8 9C10.9 9 13.25 10.9 13.25 14" />
        </svg>
      </button>
    </SignInButton>
  );
}
