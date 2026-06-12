import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';

type FeatureIcon = 'gamepad' | 'quiz' | 'projector' | 'chart';
type FeatureTone = 'primary' | 'accent' | 'amber' | 'violet';

type Feature = {
  readonly icon: FeatureIcon;
  readonly tileTone: FeatureTone;
  readonly title: string;
  readonly body: string;
};

type Step = {
  readonly number: string;
  readonly title: string;
  readonly body: string;
};

const TILE_CLASSES: Record<FeatureTone, string> = {
  primary: 'bg-bubbly-primary/15 text-[var(--bubbly-primary-deep)]',
  accent: 'bg-bubbly-accent/15 text-[var(--bubbly-accent)]',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
};

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BubblyCardComponent],
  templateUrl: './landing-page.component.html',
})
export class LandingPageComponent {
  protected readonly year = new Date().getFullYear();

  protected readonly features: readonly Feature[] = [
    {
      icon: 'gamepad',
      tileTone: 'primary',
      title: 'Join a Game',
      body: 'Hop into a live session with just a 6-digit PIN. No account required — just type your name and play.',
    },
    {
      icon: 'quiz',
      tileTone: 'accent',
      title: 'Build a Quiz',
      body: 'Five question types — multiple choice, true/false, ordering, matching, fill-in-the-blank. Save unlimited quizzes in your library.',
    },
    {
      icon: 'projector',
      tileTone: 'amber',
      title: 'Run a Session',
      body: 'Project questions on the big screen. Watch the live leaderboard. Pick a chest or steal gold in Treasure Forge mode.',
    },
    {
      icon: 'chart',
      tileTone: 'violet',
      title: 'Track Progress',
      body: 'Every game, every score, every player — captured automatically so you can review what worked.',
    },
  ];

  protected readonly steps: readonly Step[] = [
    {
      number: '1',
      title: 'Host Creates a Session',
      body: 'Pick a quiz from your library, and share the 6-digit PIN with the room.',
    },
    {
      number: '2',
      title: 'Players Join',
      body: 'They type a name on their phone — no signup, no app install, instant entry.',
    },
    {
      number: '3',
      title: 'Everyone Plays Together',
      body: 'Questions stream to the projector, answers buzz in from phones, and the scoreboard updates live.',
    },
  ];

  protected iconTileClass(tone: FeatureTone): string {
    return TILE_CLASSES[tone];
  }
}
