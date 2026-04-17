import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface PodiumPlayer {
  rank: 1 | 2 | 3;
  name: string;
  score: string;
  avatarImage: string;
}

interface RunnerUp {
  rank: number;
  name: string;
  score: string;
  initials: string;
}

@Component({
  selector: 'app-leaderboards-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './leaderboards-page.component.html',
  styleUrl: './leaderboards-page.component.css',
})
export class LeaderboardsPageComponent {
  protected readonly podium: PodiumPlayer[] = [
    {
      rank: 2,
      name: 'Alex M.',
      score: '8,450',
      avatarImage:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD_5tafePYPlG4O31EmHDNZY8pAgkjwPFAe-ZL_AkJwAewNfcz_edwR_IRunE3-3HDF7w_NpIWwEMHao-OIsgAoEQPzEvFjeytUp_RJVMnV1xx0CCg-CBQmVGVRrlYA1AjsQX0U-TlaUPN5w8oEmGqvCOyvBRQLRUofHut559xkplyql5KaqzbP_5KYghijTEIaYcqkP0C7PXngo330e8Ru9m5kZuSYV2fItCxAmDqvJyfBShT-cXf-nUuYTTGa0eeDeenAzjPXyzM',
    },
    {
      rank: 1,
      name: 'Sarah J.',
      score: '12,300',
      avatarImage:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCf6CPp95arpDlrZbisJKmiqDk1c570pOAOLZzcKZM9WRsNqZt2ILLtIPVr_xQGb1VDQ-RgLCiVdgLpx_2S1aQG9aA2sTEoBiPnDd7eycqc741KqmdM4lcAeHa2zFm8pxJnWJRv0doHCcWukHfd3G8L9-lbZWNC3Qa5HQIxPtPfNN8K-kbjzylnwvTxJAHWuvBPyb3w0IfBLlnEyio7uU7ohQRMR5SynqB9CnRk3qy2SVg8cIqMoONOa19rWnzSXxOj0pYnRwGG7kU',
    },
    {
      rank: 3,
      name: 'Chris T.',
      score: '7,120',
      avatarImage:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAA0c6ogUfQU5bjPtVkMJENND-RtZZPvaIiO-NNIwavdjGB8BpwYpcurRAlW4AjTPC52Hp4pE3HxwQvFS9ChPoQWDAllVa9ULcj0QaJp2hJb4T46MS6c_BYMiazQcBYwrcPoAWzMMLnluDh8NMitURcZ-cLjgaL6jiiTuB-sUvydqNcsHhJ-wTHRYnYKpimT4Qf6JUIY3ada5nGEi73Zz9VCpMrr0oNIX87yMwVmhRs2R4PLQZ8ZjkQyLrHdz_0Njdk0KosNbpGcCs',
    },
  ];

  protected readonly chasers: RunnerUp[] = [
    { rank: 4, name: 'David J.', score: '6,800', initials: 'DJ' },
    { rank: 5, name: 'Emma W.', score: '6,250', initials: 'EW' },
    { rank: 6, name: 'Michael K.', score: '5,900', initials: 'MK' },
    { rank: 7, name: 'Sam L.', score: '5,100', initials: 'SL' },
  ];

  protected podiumHeight(rank: 1 | 2 | 3): string {
    if (rank === 1) {
      return 'h-56';
    }

    if (rank === 2) {
      return 'h-40';
    }

    return 'h-32';
  }

  protected podiumColor(rank: 1 | 2 | 3): string {
    if (rank === 1) {
      return 'bg-[#ffc107]';
    }

    if (rank === 2) {
      return 'bg-[#c0c0c0]';
    }

    return 'bg-[#cd7f32]';
  }
}
