import { Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

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
    path: 'settings/backend',
    loadComponent: () =>
      import('./features/settings/backend-selector.component').then(
        (m) => m.BackendSelectorComponent
      ),
  },
  // Public guest-play routes — anyone with a PIN can join, no account required.
  {
    path: 'play',
    loadComponent: () =>
      import('./features/play/play-page.component').then((m) => m.PlayPageComponent),
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
  // Bubbly Royale player view — public guest-play
  {
    path: 'play/br/:pin',
    loadComponent: () =>
      import('./features/game/br-player-page.component').then((m) => m.BrPlayerPageComponent),
  },
  {
    path: 'leaderboards',
    loadComponent: () =>
      import('./features/leaderboards/leaderboards-page.component').then(
        (m) => m.LeaderboardsPageComponent
      ),
  },
  // Public quiz discovery — browseable while logged out (anonymous play allowed
  // for public/unlisted quizzes via share code). No authGuard on purpose.
  {
    path: 'quizzes/discover',
    loadComponent: () =>
      import('./features/discover/discover-quizzes-page.component').then(
        (m) => m.DiscoverQuizzesPageComponent
      ),
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
            path: 'quizzes/ai',
            loadComponent: () =>
              import('./features/dashboard/quizzes/ai-quiz-page.component').then(
                (m) => m.AiQuizPageComponent
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
          // Dashboard-internal alias of the public /quizzes/discover route.
          // Renders the same component but inside the dashboard shell so the
          // sidebar stays visible and the auth-aware Host Session CTA is shown.
          {
            path: 'quizzes/discover',
            loadComponent: () =>
              import('./features/discover/discover-quizzes-page.component').then(
                (m) => m.DiscoverQuizzesPageComponent
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
          {
            path: 'admin',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/dashboard/admin-dashboard.component').then(
                (m) => m.AdminDashboardComponent
              ),
          },
        ],
      },
      // Host route — hosts always have an account.
      {
        path: 'host/:pin',
        loadComponent: () =>
          import('./features/host/host-page.component').then((m) => m.HostPageComponent),
      },
      // Bubbly Royale host view — game-show projector (auth required)
      {
        path: 'host/:pin/br',
        loadComponent: () =>
          import('./features/host/br-host-page.component').then((m) => m.BrHostPageComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
