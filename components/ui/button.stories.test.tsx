import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as stories from './button.stories';

const { Default, Secondary } = composeStories(stories);

describe('Button stories', () => {
  it('renders the default button', async () => {
    const user = userEvent.setup();
    render(<Default />);

    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);

    expect(button).toBeInTheDocument();
  });

  it('applies variants from story args', () => {
    render(<Secondary />);

    const button = screen.getByRole('button', { name: /secondary button/i });
    expect(button).toHaveClass('bg-secondary');
  });
});
