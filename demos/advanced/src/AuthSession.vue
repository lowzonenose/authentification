<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAuth } from 'authentification-vue-oidc'

const { user, isAuthenticated, status, error, login, logout, getAccessToken, hasRole, on } = useAuth()
const tokenCheck = ref('')
const recentEvent = ref('Aucun événement')
const labels = {
  initializing: 'Initialisation',
  unauthenticated: 'Déconnecté',
  authenticating: 'Redirection en cours',
  authenticated: 'Connecté',
  refreshing: 'Renouvellement',
  error: 'Erreur',
}
const statusLabel = computed(() => labels[status.value])
const claimsText = computed(() => JSON.stringify(user.value?.claims ?? {}, null, 2))
const unsubscribers = [
  on('login', (currentUser) => { recentEvent.value = `login · ${currentUser.name ?? currentUser.sub}` }),
  on('logout', () => { recentEvent.value = 'logout' }),
  on('tokenRefreshed', () => { recentEvent.value = 'tokenRefreshed' }),
  on('sessionExpired', () => { recentEvent.value = 'sessionExpired' }),
  on('error', (authError) => { recentEvent.value = `error · ${authError.code}` }),
]

onBeforeUnmount(() => unsubscribers.forEach((unsubscribe) => unsubscribe()))

async function checkToken() {
  tokenCheck.value = 'Vérification…'
  try {
    await getAccessToken()
    tokenCheck.value = 'Jeton valide, valeur masquée'
  } catch {
    tokenCheck.value = 'Aucun jeton valide'
  }
}

async function startLogin() {
  try {
    await login()
  } catch {
    // L’état et l’événement error sont exposés par le composable.
  }
}

async function startLogout() {
  try {
    await logout()
  } catch {
    // L’état et l’événement error sont exposés par le composable.
  }
}
</script>

<template>
  <section class="session-panel" aria-labelledby="session-title">
    <div class="section-heading session-heading">
      <div>
        <p class="eyebrow">ÉTAT DE LA SESSION</p>
        <h2 id="session-title">{{ isAuthenticated ? 'Identité active' : 'En attente d’identité' }}</h2>
      </div>
      <span class="status-badge" :class="`status-${status}`">
        <span class="status-dot"></span>{{ statusLabel }}
      </span>
    </div>

    <div class="session-content">
      <div v-if="isAuthenticated && user" class="identity-block">
        <div class="avatar-mark">{{ (user.name ?? user.sub).slice(0, 1).toUpperCase() }}</div>
        <div class="identity-text">
          <h3>{{ user.name ?? user.sub }}</h3>
          <p>{{ user.email ?? user.sub }}</p>
        </div>
        <span v-if="hasRole('admin')" class="role-badge">ADMIN</span>
      </div>

      <div v-else class="empty-state">
        <span class="empty-symbol" aria-hidden="true">◎</span>
        <p>{{ status === 'initializing' ? 'Chargement de la session' : 'Aucune session active' }}</p>
      </div>

      <div class="action-row">
        <button v-if="!isAuthenticated" class="primary-button" :disabled="status === 'initializing'" @click="startLogin">
          <span>Se connecter</span><span aria-hidden="true">↗</span>
        </button>
        <template v-else>
          <button class="secondary-button" @click="checkToken">Vérifier le jeton</button>
          <button class="text-button" @click="startLogout">Se déconnecter <span aria-hidden="true">↗</span></button>
        </template>
      </div>
      <p v-if="tokenCheck" class="token-result" role="status">{{ tokenCheck }}</p>
      <p v-if="error" class="error-line" role="alert">{{ error.code }}</p>
    </div>

    <div class="data-grid">
      <section class="data-section">
        <div class="data-title"><span>01</span><h3>Rôles détectés</h3></div>
        <div v-if="user?.roles.length" class="role-list">
          <span v-for="role in user.roles" :key="role" class="role-chip">{{ role }}</span>
        </div>
        <p v-else class="muted-value">{{ user ? 'Aucun rôle trouvé' : '—' }}</p>
      </section>
      <section class="data-section">
        <div class="data-title"><span>02</span><h3>Claims</h3></div>
        <pre class="claims-view">{{ claimsText }}</pre>
      </section>
    </div>

    <div class="event-strip">
      <span class="eyebrow">DERNIER ÉVÉNEMENT</span>
      <code>{{ recentEvent }}</code>
    </div>
  </section>
</template>