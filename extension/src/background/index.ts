import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PLASMO_PUBLIC_SUPABASE_URL!,
  process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: {
        getItem: (key) =>
          new Promise((resolve) =>
            chrome.storage.local.get([key], (result) => resolve(result[key] ?? null))
          ),
        setItem: (key, value) =>
          new Promise((resolve) =>
            chrome.storage.local.set({ [key]: value }, resolve)
          ),
        removeItem: (key) =>
          new Promise((resolve) =>
            chrome.storage.local.remove([key], resolve)
          ),
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_SESSION") {
    supabase.auth.getSession().then(({ data }) => sendResponse({ session: data.session }));
    return true;
  }

  if (message.type === "SIGN_IN_GOOGLE") {
    (async () => {
      const redirectTo = chrome.identity.getRedirectURL();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error || !data.url) {
        sendResponse({ error: error?.message ?? "No URL returned" });
        return;
      }

      chrome.identity.launchWebAuthFlow(
        { url: data.url, interactive: true },
        async (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            sendResponse({ error: chrome.runtime.lastError?.message ?? "Auth cancelled" });
            return;
          }

          const url = new URL(responseUrl);

          // PKCE flow: code in query params
          const code = url.searchParams.get("code");
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            sendResponse({ error: exchangeError?.message ?? null });
            return;
          }

          // Implicit flow: tokens in hash fragment
          const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            sendResponse({ error: sessionError?.message ?? null });
            return;
          }

          sendResponse({ error: `Unrecognised redirect: ${responseUrl}` });
        }
      );
    })();
    return true;
  }

  if (message.type === "SIGN_OUT") {
    supabase.auth.signOut().then(() => sendResponse({ ok: true }));
    return true;
  }
});
