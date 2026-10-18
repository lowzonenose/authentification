<script setup>
import { inject, reactive, ref } from 'vue'
import { authOptionsFromEnv, AuthError } from '@lowzonenose/authentification-vue-oidc'

const authReady = inject('authReady')
const initialOptions = inject('initialOptions')
const activateAuth = inject('activateAuth')
const activeDemo = ref('events')

const fields = reactive({
  authority: initialOptions.authority ?? '',
  clientId: initialOptions.clientId ?? '',
  redirectUri: initialOptions.redirectUri ?? `${window.location.origin}/`,
  silentRedirectUri: initialOptions.silentRedirectUri ?? `${window.location.origin}/silent-renew.html`,
  scope: initialOptions.scope ?? 'openid profile email',
})
const setupError = ref('')

function installAuth() {
  setupError.value = ''
  try {
    const fromEnv = authOptionsFromEnv({
      IAM_AUTHORITY: fields.authority,
      IAM_CLIENT_ID: fields.clientId,
      IAM_REDIRECT_URI: fields.redirectUri,
      IAM_SCOPE: fields.scope,
    })
    activateAuth({
      ...fromEnv,
      postLogoutRedirectUri: window.location.origin,
      ...(fields.silentRedirectUri ? { silentRedirectUri: fields.silentRedirectUri } : {}),
      storage: 'memory',
    })
  } catch (error) {
    setupError.value = error instanceof AuthError ? error.code : 'CONFIG_INVALID'
  }
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <a class="wordmark" href="/" aria-label="Démonstration OIDC Vue 3">
        <span class="wordmark-icon">O</span>
        <span>OIDC / VUE 3</span>
      </a>
      <div class="topbar-meta">
        <span class="meta-dot"></span>
        CLIENT PUBLIC <span class="meta-divider">/</span> PKCE
      </div>
      <span class="version-tag">DEMO 0.1</span>
    </header>

    <main class="workspace">
      <section class="intro">
        <p class="eyebrow">AUTHENTIFICATION · OPENID CONNECT</p>
        <h1>Session<br /><em>en clair.</em></h1>
        <p class="intro-copy">Un poste d'observation pour le cycle de vie OIDC de l'application.</p>
        <div class="protocol-mark" aria-hidden="true">
          <span>APP</span><i></i><span>IDP</span><i></i><span>API</span>
        </div>
        <div v-if="authReady" class="demo-switch" role="tablist" aria-label="Démonstrations">
          <button
            type="button"
            role="tab"
            :aria-selected="activeDemo === 'events'"
            :class="{ selected: activeDemo === 'events' }"
            @click="activeDemo = 'events'"
          >Événements</button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeDemo === 'session'"
            :class="{ selected: activeDemo === 'session' }"
            @click="activeDemo = 'session'"
          >Session</button>
        </div>
        <span class="intro-index">01 — CONNEXION</span>
      </section>

      <section v-if="!authReady" class="config-panel" aria-labelledby="config-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">PARAMÈTRES DU CLIENT</p>
            <h2 id="config-title">Connexion à l'IdP</h2>
          </div>
          <span class="step-number">01</span>
        </div>

        <form class="config-form" @submit.prevent="installAuth">
          <label>
            <span>Issuer OIDC</span>
            <input v-model.trim="fields.authority" required placeholder="https://iam.example.org/realms/demo" />
          </label>
          <label>
            <span>Client ID</span>
            <input v-model.trim="fields.clientId" required autocomplete="off" placeholder="vue3-auth-demo" />
          </label>
          <label>
            <span>URI de callback</span>
            <input v-model.trim="fields.redirectUri" required type="url" />
          </label>
          <label>
            <span>URI iframe silencieuse <small>OPTIONNELLE</small></span>
            <input v-model.trim="fields.silentRedirectUri" type="url" placeholder="https://app.example.org/silent-renew.html" />
          </label>
          <label>
            <span>Scopes</span>
            <input v-model.trim="fields.scope" placeholder="openid profile email" />
          </label>
          <p v-if="setupError" class="error-line" role="alert">{{ setupError }}</p>
          <button class="primary-button" type="submit">
            <span>Initialiser le client</span><span aria-hidden="true">↗</span>
          </button>
        </form>
        <p class="panel-footnote"><span class="footnote-dot"></span> Stockage des tokens : mémoire</p>
      </section>

      <AuthSession v-else-if="activeDemo === 'session'" />
      <EventsDemo v-else />
    </main>

    <footer class="footer">
      <span>AUTHENTIFICATION VUE OIDC</span>
      <span>LES TOKENS NE SONT PAS AFFICHÉS</span>
    </footer>
  </div>
</template>