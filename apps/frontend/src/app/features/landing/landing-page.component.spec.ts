import { render, screen } from '@testing-library/angular';
import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  it('initializes successfully', async () => {
    const view = await render(LandingPageComponent);

    expect(view.fixture.componentInstance).toBeTruthy();
  });

  it('renders introductory Forge text', async () => {
    await render(LandingPageComponent);

    // The page contains the QuizForge brand in multiple places (header, hero,
    // footer) — use `getAllByText` to assert at least one match exists.
    expect(screen.getAllByText(/Forge/i).length).toBeGreaterThan(0);
  });
});
