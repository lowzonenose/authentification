import { createApp, ref } from 'vue'
import { authOptionsFromEnv, createAuth } from '@lowzonenose/authentification-vue-oidc'
import App from './App.vue'
import AuthSession from './AuthSession.vue'
import EventsDemo from './EventsDemo.vue'
import './style.css'

const app = createApp(App)
const authReady = ref(false)
const env = import.meta.env
const initialOptions = {
  ...authOptionsFromEnv({
    IAM_AUTHORITY: env.VITE_IAM_AUTHORITY,
    IAM_URL: env.VITE_IAM_URL,
    IAM_REALM: env.VITE_IAM_REALM,
    IAM_CLIENT_ID: env.VITE_IAM_CLIENT_ID,
    IAM_REDIRECT_URI: env.VITE_IAM_REDIRECT_URI,
    IAM_POST_LOGOUT_REDIRECT_URI: env.VITE_IAM_POST_LOGOUT_REDIRECT_URI,
    IAM_SCOPE: env.VITE_IAM_SCOPE,
    IAM_STORAGE: env.VITE_IAM_STORAGE,
    IAM_DEBUG: env.VITE_IAM_DEBUG,
  }),
  ...(env.VITE_IAM_SILENT_REDIRECT_URI
    ? { silentRedirectUri: env.VITE_IAM_SILENT_REDIRECT_URI }
    : {}),
}

app.component('AuthSession', AuthSession)
app.component('EventsDemo', EventsDemo)
app.provide('authReady', authReady)
app.provide('initialOptions', initialOptions)
app.provide('activateAuth', (options) => {
  app.use(createAuth(options))
  authReady.value = true
})
app.mount('#app')