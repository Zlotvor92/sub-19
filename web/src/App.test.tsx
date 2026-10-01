import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App (ljuska)', () => {
  it('prikazuje naziv aplikacije', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SUB-20');
  });
});
