import { Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Route[] = [
	{
		path: '',
		loadComponent: () =>
			import('./features/landing/landing-page.component').then((m) => m.LandingPageComponent),
	},
	{
		path: 'auth',
		loadComponent: () =>
			import('./features/auth/auth-page.component').then((m) => m.AuthPageComponent),
	},
	{
		path: 'dashboard',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./features/dashboard/dashboard-shell.component').then((m) => m.DashboardShellComponent),
		children: [
			{
				path: '',
				loadComponent: () =>
					import('./features/dashboard/dashboard-page.component').then(
						(m) => m.DashboardPageComponent
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
				path: 'create-session',
				loadComponent: () =>
					import('./features/dashboard/dashboard-create-session-page.component').then(
						(m) => m.DashboardCreateSessionPageComponent
					),
			},
			{
				path: 'sessions',
				loadComponent: () =>
					import('./features/dashboard/dashboard-sessions-page.component').then(
						(m) => m.DashboardSessionsPageComponent
					),
			},
		],
	},
	{
		path: 'game-lobby/:pin',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./features/game/game-lobby-page.component').then((m) => m.GameLobbyPageComponent),
	},
	{
		path: 'leaderboards',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./features/leaderboards/leaderboards-page.component').then(
				(m) => m.LeaderboardsPageComponent
			),
	},
	{
		path: '**',
		redirectTo: '',
	},
];
