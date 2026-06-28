import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'register',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'play',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/quizzes',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/create-session',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/groups',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/groups/discover',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/quizzes/new',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/quizzes/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/groups/new',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/groups/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'dashboard/admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'leaderboards',
    renderMode: RenderMode.Client,
  },
  {
    path: 'quizzes/discover',
    renderMode: RenderMode.Client,
  },
  {
    path: 'game-lobby/:pin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'game/:pin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'host/:pin',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
