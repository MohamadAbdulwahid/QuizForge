import { render, screen } from '@testing-library/angular';
import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  it('initializes successfully', async () => {
    const view = await render(LandingPageComponent);

    expect(view.fixture.componentInstance).toBeTruthy();
  });

  it('renders introductory Forge text', async () => {
    await render(LandingPageComponent);

    expect(screen.getByText(/Forge/i)).toBeTruthy();
  });
});
