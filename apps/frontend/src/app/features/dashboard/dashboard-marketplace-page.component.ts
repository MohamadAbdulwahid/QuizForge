import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { BubblyCardComponent } from '../../shared/ui/bubbly-card.component';

interface QuizPack {
  id: string;
  title: string;
  emoji: string;
  description: string;
  questionCount: number;
  category: 'STEM' | 'Humanities' | 'Language' | 'Pop Culture';
  accent: 'primary' | 'accent' | 'amber' | 'violet';
}

@Component({
  selector: 'app-dashboard-marketplace-page',
  standalone: true,
  imports: [CommonModule, BubblyCardComponent],
  templateUrl: './dashboard-marketplace-page.component.html',
})
export class DashboardMarketplacePageComponent {
  protected readonly packs = signal<QuizPack[]>([
    {
      id: 'math-blitz',
      title: 'Math Blitz',
      emoji: '🧮',
      description: 'Quick-fire arithmetic, fractions, and mental math. Great for warm-ups.',
      questionCount: 24,
      category: 'STEM',
      accent: 'primary',
    },
    {
      id: 'world-capitals',
      title: 'World Capitals',
      emoji: '🌍',
      description: 'Match countries to their capitals. Spanning all six inhabited continents.',
      questionCount: 40,
      category: 'Humanities',
      accent: 'accent',
    },
    {
      id: 'spanish-starter',
      title: 'Spanish Starter',
      emoji: '🗣️',
      description: 'Greetings, numbers, colours, and 50 of the most common everyday phrases.',
      questionCount: 32,
      category: 'Language',
      accent: 'amber',
    },
    {
      id: 'movie-trivia',
      title: 'Movie Trivia',
      emoji: '🎬',
      description: 'Blockbusters, classics, and hidden gems. Tested by film-buffs.',
      questionCount: 28,
      category: 'Pop Culture',
      accent: 'violet',
    },
    {
      id: 'science-lab',
      title: 'Science Lab',
      emoji: '🧪',
      description:
        'Periodic table, famous experiments, biology basics — perfect for a chemistry block.',
      questionCount: 36,
      category: 'STEM',
      accent: 'primary',
    },
    {
      id: 'history-stories',
      title: 'History Stories',
      emoji: '📜',
      description:
        'Moments that shaped the modern world, from the printing press to the moon landing.',
      questionCount: 30,
      category: 'Humanities',
      accent: 'accent',
    },
  ]);

  protected accentClasses(accent: QuizPack['accent']): string {
    switch (accent) {
      case 'primary':
        return 'bg-bubbly-primary/15 text-bubbly-primary-deep';
      case 'accent':
        return 'bg-bubbly-accent/15 text-bubbly-accent';
      case 'amber':
        return 'bg-amber-100 text-amber-700';
      case 'violet':
        return 'bg-violet-100 text-violet-700';
    }
  }

  protected tileGradient(accent: QuizPack['accent']): string {
    switch (accent) {
      case 'primary':
        return 'from-bubbly-primary/15 via-bubbly-primary/5 to-transparent';
      case 'accent':
        return 'from-bubbly-accent/15 via-bubbly-accent/5 to-transparent';
      case 'amber':
        return 'from-amber-100 via-amber-50 to-transparent';
      case 'violet':
        return 'from-violet-100 via-violet-50 to-transparent';
    }
  }
}
