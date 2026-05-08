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
    path: 'dashboard/sessions',
    renderMode: RenderMode.Client,
  },
  {
    path: 'builder/new',
    renderMode: RenderMode.Client,
  },
  {
    path: 'builder/:id',
    renderMode: RenderMode.Client,
  },
  {
    path: 'leaderboards',
    renderMode: RenderMode.Client,
  },
  {
    path: 'game-lobby/:pin',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
