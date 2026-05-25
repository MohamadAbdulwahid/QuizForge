import { Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing-page.component').then((m) => m.LandingPageComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'auth',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'play',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/play/play-page.component').then((m) => m.PlayPageComponent),
  },
  // Protected routes — no shell wrapper, auth guard applied to all children
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // Dashboard shell routes
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-shell.component').then(
            (m) => m.DashboardShellComponent
          ),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/dashboard/dashboard-page.component').then(
                (m) => m.DashboardPageComponent
              ),
          },
          {
            path: 'create-session',
            loadComponent: () =>
              import('./features/dashboard/dashboard-create-session-page.component').then(
                (m) => m.DashboardCreateSessionPageComponent
              ),
          },
          {
            path: 'quizzes',
            loadComponent: () =>
              import('./features/dashboard/dashboard-quizzes-page.component').then(
                (m) => m.DashboardQuizzesPageComponent
              ),
          },
          {
            path: 'quizzes/new',
            loadComponent: () =>
              import('./features/dashboard/quizzes/quiz-builder-page.component').then(
                (m) => m.QuizBuilderPageComponent
              ),
          },
          {
            path: 'quizzes/:id',
            loadComponent: () =>
              import('./features/dashboard/quizzes/quiz-builder-page.component').then(
                (m) => m.QuizBuilderPageComponent
              ),
          },
          {
            path: 'groups',
            loadComponent: () =>
              import('./features/dashboard/dashboard-groups-page.component').then(
                (m) => m.DashboardGroupsPageComponent
              ),
          },
          {
            path: 'groups/discover',
            loadComponent: () =>
              import('./features/dashboard/dashboard-group-discovery-page.component').then(
                (m) => m.DashboardGroupDiscoveryPageComponent
              ),
          },
          {
            path: 'groups/new',
            loadComponent: () =>
              import('./features/dashboard/groups/groups-create-page.component').then(
                (m) => m.GroupsCreatePageComponent
              ),
          },
          {
            path: 'groups/:id',
            loadComponent: () =>
              import('./features/dashboard/groups/groups-detail-page.component').then(
                (m) => m.GroupsDetailPageComponent
              ),
          },
        ],
      },
      // Game routes — standalone, no dashboard shell wrapper
      {
        path: 'game-lobby/:pin',
        loadComponent: () =>
          import('./features/game/game-lobby-page.component').then((m) => m.GameLobbyPageComponent),
      },
      {
        path: 'game/:pin',
        loadComponent: () =>
          import('./features/game/game-play-page.component').then((m) => m.GamePlayPageComponent),
      },
      {
        path: 'host/:pin',
        // TODO: Create HostPageComponent in subtask 06 — this lazy import will fail until the file exists
        loadComponent: () =>
          import('./features/host/host-page.component').then((m) => m.HostPageComponent),
      },
      {
        path: 'leaderboards',
        loadComponent: () =>
          import('./features/leaderboards/leaderboards-page.component').then(
            (m) => m.LeaderboardsPageComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
