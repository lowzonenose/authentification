<script setup>
import { RouterLink, RouterView } from 'vue-router';
import { useAuth } from '@lowzonenose/authentification-vue-oidc';
import UserStatus from './components/UserStatus.vue';

const { status, error } = useAuth();
</script>

<template>
  <header>
    <img alt="logo" class="logo" src="./assets/logo.svg" width="64" height="64" />
    <div>
      <h1>Authentification OIDC</h1>
      <UserStatus />
      <nav>
        <RouterLink to="/">Connexion</RouterLink>
        <RouterLink to="/profil">Profil</RouterLink>
        <RouterLink to="/session">Session</RouterLink>
      </nav>
    </div>
  </header>

  <main>
    <p v-if="status === 'initializing'" role="status">Initialisation de la session…</p>
    <template v-else>
      <p v-if="error" role="alert">{{ error.code }} : {{ error.message }}</p>
      <RouterView />
    </template>
  </main>
</template>

<style scoped>
header {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

h1 {
  font-size: 1.5rem;
  font-weight: 500;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
  font-weight: 600;
}

@media (max-width: 600px) {
  header {
    align-items: flex-start;
    gap: 0.75rem;
  }
}
</style>
