import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonTestComponent } from '../../shared/components/button-test.component';

type StitchScreenPreview = {
  title: string;
  subtitle: string;
  imageUrl: string;
  route: string;
};

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonTestComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
})
export class LandingPageComponent {
  protected readonly stitchScreenPreviews: StitchScreenPreview[] = [
    {
      title: 'Dashboard',
      subtitle: 'Quick Join, featured game modes, and arcade navigation.',
      imageUrl: 'assets/stitch/dashboard.png',
      route: '/dashboard',
    },
    {
      title: 'Game Lobby',
      subtitle: 'Live room PIN, avatar grid, and player waiting flow.',
      imageUrl: 'assets/stitch/game-lobby.png',
      route: '/game-lobby/729415',
    },
    {
      title: 'Leaderboards',
      subtitle: 'Podium ranking reveal and post-game score summaries.',
      imageUrl: 'assets/stitch/leaderboards.png',
      route: '/leaderboards',
    },
  ];
}
