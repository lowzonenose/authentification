<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from 'authentification-vue-oidc'

const { status, isAuthenticated, error, login, logout, on } = useAuth()
const events = ref([])
const statusLabels = {
  initializing: 'Initialisation',
  unauthenticated: 'Déconnecté',
  authenticating: 'Redirection en cours',
  authenticated: 'Connecté',
  refreshing: 'Renouvellement',
  error: 'Erreur',
}
let nextEventId = 0

function record(name, detail) {
  events.value.unshift({
    id: nextEventId++,
    name,
    time: new Date().toLocaleTimeString('fr-FR'),
    detail,
  })
  events.value = events.value.slice(0, 30)
}

record('ready', `Abonnement actif · état ${statusLabels[status.value]}`)
const stopWatchingInitialization = watch(status, (currentStatus, previousStatus) => {
  if (previousStatus === 'initializing') {
    record('ready', `Initialisation terminée · ${statusLabels[currentStatus]}`)
    stopWatchingInitialization()
  }
}, { flush: 'sync' })

const unsubscribe = [
  on('login', (user) => record('login', user.name ?? user.sub)),
  on('logout', () => record('logout', 'Session locale terminée')),
  on('tokenRefreshed', () => record('tokenRefreshed', 'Access token renouvelé')),
  on('sessionExpired', () => record('sessionExpired', 'Session expirée')),
  on('error', (authError) => record('error', authError.code)),
]

onBeforeUnmount(() => {
  stopWatchingInitialization()
  unsubscribe.forEach((stop) => stop())
})

async function startLogin() {
  try {
    await login()
  } catch {
    // Le code d’erreur est déjà transmis via useAuth().on('error').
  }
}

async function startLogout() {
  try {
    await logout()
  } catch {
    // Le code d’erreur est déjà transmis via useAuth().on('error').
  }
}
</script>

<template>
  <section class="events-panel" aria-labelledby="events-title">
    <header class="events-header">
      <div>
        <p class="eyebrow">CONTRAT useAuth().on()</p>
        <h2 id="events-title">Journal des événements</h2>
      </div>
      <span class="status-badge" :class="`status-${status}`">
        <span class="status-dot"></span>{{ statusLabels[status] }}
      </span>
    </header>

    <div class="events-actions">
      <button v-if="!isAuthenticated" class="primary-button" :disabled="status === 'initializing'" @click="startLogin">
        <span>Déclencher login</span><span aria-hidden="true">↗</span>
      </button>
      <button v-else class="secondary-button" @click="startLogout">Déclencher logout</button>
      <button class="clear-events" type="button" :disabled="events.length === 0" @click="events = []">
        Effacer le journal
      </button>
      <span v-if="error" class="error-line" role="alert">{{ error.code }}</span>
    </div>

    <ol class="event-log" aria-live="polite" aria-relevant="additions">
      <li v-for="entry in events" :key="entry.id" class="event-row">
        <time class="event-time">{{ entry.time }}</time>
        <span class="event-name" :class="`event-${entry.name}`">{{ entry.name }}</span>
        <span class="event-detail">{{ entry.detail }}</span>
      </li>
      <li v-if="events.length === 0" class="event-empty">Aucun événement. Lance une connexion pour commencer.</li>
    </ol>

    <footer class="events-footer">
      <span>{{ events.length }} / 30 entrées</span>
      <span>Les tokens et claims ne sont jamais journalisés</span>
    </footer>
  </section>
</template>