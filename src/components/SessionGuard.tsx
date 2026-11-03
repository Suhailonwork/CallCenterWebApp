'use client';

import { useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * Sends the user back to the sign-in page when their session ends while a
 * console is open (token expiry, account deactivated). Page navigations are
 * already covered by the middleware; this covers the API calls a long-lived
 * page keeps making on its own, which would otherwise just fail one by one.
 *
 * A live phone call is never cut off for it: the SIP leg does not depend on
 * the web session, so the redirect waits until the call has ended.
 */

let callActive = false;
let redirectPending = false;
let redirected = false;

function goToLogin() {
  if (redirected) return;
  redirected = true;
  window.location.assign('/login');
}

/** The dialer reports whether a call is on the line right now. */
export function setCallActive(active: boolean) {
  callActive = active;
  if (!active && redirectPending) goToLogin();
}

/**
 * Endpoints whose 401 is not a reason to navigate: the auth calls answer with
 * one, and the dialer's lead release fires while the page is already being
 * torn down (sign-out included).
 */
const AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/employee/dialer/release',
]);

function requestPath(input: RequestInfo | URL): URL | null {
  try {
    const raw =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return new URL(raw, window.location.origin);
  } catch {
    return null;
  }
}

export function SessionGuard() {
  useEffect(() => {
    const original = window.fetch;
    const guarded: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);
      if (res.status === 401 && !redirected) {
        const url = requestPath(input);
        if (
          url &&
          url.origin === window.location.origin &&
          url.pathname.startsWith('/api/') &&
          !AUTH_PATHS.has(url.pathname)
        ) {
          if (!redirectPending) {
            redirectPending = true;
            toast.error('Your session has expired — please sign in again.', {
              toastId: 'session-expired',
            });
          }
          if (!callActive) goToLogin();
        }
      }
      return res;
    };
    window.fetch = guarded;
    return () => {
      if (window.fetch === guarded) window.fetch = original;
    };
  }, []);

  return null;
}
