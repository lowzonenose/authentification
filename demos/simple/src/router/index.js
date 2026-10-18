import { createRouter, createWebHistory } from 'vue-router';
import { createAuthGuard } from '@lowzonenose/authentification-vue-oidc';

import LoginView from '../views/LoginView.vue';
import ProfileView from '../views/ProfileView.vue';
import SessionView from '../views/SessionView.vue';

export default function createDemoRouter() {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
      { path: '/', name: 'login', component: LoginView, meta: { isAuthCallback: true } },
      { path: '/profil', name: 'profile', component: ProfileView, meta: { requiresAuth: true } },
      { path: '/session', name: 'session', component: SessionView },
      { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
  });

  router.beforeEach(createAuthGuard({ callbackRouteNames: ['login'] }));
  return router;
}
