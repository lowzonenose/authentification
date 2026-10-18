import "./assets/main.css";

import { createApp } from "vue";
import { authOptionsFromEnv, createAuth } from 'authentification-vue-oidc';

import App from "./App.vue";
import createDemoRouter from "./router";

const app = createApp(App);
const env = import.meta.env;
const baseUrl = new URL(env.BASE_URL, window.location.origin);
app.use(createAuth({
  ...authOptionsFromEnv({
    IAM_AUTHORITY: env.IAM_AUTHORITY ?? env.VITE_IAM_AUTHORITY,
    IAM_URL: env.IAM_URL ?? env.VITE_IAM_URL,
    IAM_REALM: env.IAM_REALM ?? env.VITE_IAM_REALM,
    IAM_CLIENT_ID: env.IAM_CLIENT_ID ?? env.VITE_IAM_CLIENT_ID,
    IAM_REDIRECT_URI: env.IAM_REDIRECT_URI ?? env.VITE_IAM_REDIRECT_URI ?? baseUrl.href,
    IAM_POST_LOGOUT_REDIRECT_URI: env.IAM_POST_LOGOUT_REDIRECT_URI ?? env.VITE_IAM_POST_LOGOUT_REDIRECT_URI ?? baseUrl.href,
    IAM_SCOPE: env.IAM_SCOPE ?? env.VITE_IAM_SCOPE ?? 'openid profile email',
    IAM_STORAGE: env.IAM_STORAGE ?? env.VITE_IAM_STORAGE,
    IAM_DEBUG: env.IAM_DEBUG ?? env.VITE_IAM_DEBUG,
  }),
  silentRedirectUri: env.IAM_SILENT_REDIRECT_URI ?? env.VITE_IAM_SILENT_REDIRECT_URI ?? new URL('silent-renew.html', baseUrl).href,
  // logger: (message) => console.log(message),
}));
app.use(createDemoRouter());

app.mount("#app");
