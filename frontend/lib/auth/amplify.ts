"use client";

import { Amplify } from "aws-amplify";

/**
 * Cognito against the shared xomware_users pool, Google sign-in only.
 *
 * Configured at module scope rather than in an effect: API calls fetch the
 * session outside React, and an effect-based config would race a request
 * fired during the first render.
 *
 * None of these values are secret. The pool and client ids ship in every
 * Cognito web app (the client has no secret), and the hosted-UI domain is in
 * the redirect URL every visitor sees.
 */
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? "";

// Google is the only way in, so without the hosted-UI domain nothing works.
export const authConfigured = Boolean(USER_POOL_ID && CLIENT_ID && DOMAIN);

export const CALLBACK_PATH = "/auth/callback";

if (authConfigured) {
  // Built from the live origin so one bundle works on localhost and in
  // production; both are registered on the app client.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: CLIENT_ID,
        loginWith: {
          oauth: {
            domain: DOMAIN,
            scopes: ["email", "openid", "profile"],
            redirectSignIn: [`${origin}${CALLBACK_PATH}`],
            redirectSignOut: [origin],
            responseType: "code",
          },
        },
      },
    },
  });
}
