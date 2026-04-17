import { render, screen } from '@testing-library/angular';
import { ButtonTestComponent } from './button-test.component';

describe('ButtonTestComponent', () => {
  it('compiles successfully', async () => {
    const view = await render(ButtonTestComponent);

    expect(view.fixture.componentInstance).toBeTruthy();
  });

  it('uses Bubbly Minimalism classes', async () => {
    await render(ButtonTestComponent);

    const button = screen.getByRole('button', { name: 'Bubble Action' });

    expect(button.className).toContain('bg-[#00a5e0]');
    expect(button.className).toContain('rounded-3xl');
  });
});
