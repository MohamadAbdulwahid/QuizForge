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
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-shell.component').then(
        (m) => m.DashboardShellComponent
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then(
            (m) => m.DashboardPageComponent
          ),
      },
      {
        path: 'dashboard/quizzes',
        loadComponent: () =>
          import('./features/dashboard/dashboard-quizzes-page.component').then(
            (m) => m.DashboardQuizzesPageComponent
          ),
      },
      {
        path: 'dashboard/create-session',
        loadComponent: () =>
          import('./features/dashboard/dashboard-create-session-page.component').then(
            (m) => m.DashboardCreateSessionPageComponent
          ),
      },
      {
        path: 'dashboard/groups',
        loadComponent: () =>
          import('./features/dashboard/dashboard-groups-page.component').then(
            (m) => m.DashboardGroupsPageComponent
          ),
      },
      {
        path: 'dashboard/groups/discover',
        loadComponent: () =>
          import('./features/dashboard/dashboard-group-discovery-page.component').then(
            (m) => m.DashboardGroupDiscoveryPageComponent
          ),
      },
      {
        path: 'dashboard/groups/new',
        loadComponent: () =>
          import('./features/dashboard/groups/groups-create-page.component').then(
            (m) => m.GroupsCreatePageComponent
          ),
      },
      {
        path: 'dashboard/groups/:id',
        loadComponent: () =>
          import('./features/dashboard/groups/groups-detail-page.component').then(
            (m) => m.GroupsDetailPageComponent
          ),
      },
      {
        path: 'dashboard/sessions',
        loadComponent: () =>
          import('./features/dashboard/dashboard-sessions-page.component').then(
            (m) => m.DashboardSessionsPageComponent
          ),
      },
      {
        path: 'builder/new',
        loadComponent: () =>
          import('./features/quiz-builder/quiz-builder.component').then(
            (m) => m.QuizBuilderComponent
          ),
      },
      {
        path: 'builder/:id',
        loadComponent: () =>
          import('./features/quiz-builder/quiz-builder.component').then(
            (m) => m.QuizBuilderComponent
          ),
      },
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
