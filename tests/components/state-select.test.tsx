import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { StateSelect } from '@/components/state-select';
import { StateSelect as WebStateSelect } from '@/components/state-select.web';

const renderToStaticMarkup: (element: React.ReactNode) => string =
  require('react-dom/server').renderToStaticMarkup;

describe('billing state selection', () => {
  it('recognizes a saved abbreviation and selects a full state name', () => {
    const onChange = jest.fn();
    const view = render(<StateSelect value="CA" onChange={onChange} />);
    expect(view.getByLabelText('State')).toHaveProp('accessibilityValue', { text: 'California' });
    fireEvent.press(view.getByLabelText('State'));
    expect(view.getAllByRole('radio')).toHaveLength(51);
    expect(view.getByRole('radio', { name: 'California (CA)' })).toHaveProp('accessibilityState', { checked: true });
    fireEvent.press(view.getByRole('radio', { name: 'Texas (TX)' }));
    expect(onChange).toHaveBeenCalledWith('Texas');
    expect(view.queryByRole('radio', { name: 'Texas (TX)' })).toBeNull();
  });

  it('supports District of Columbia and lets the customer dismiss without changing the state', () => {
    const onChange = jest.fn();
    const view = render(<StateSelect value="DC" onChange={onChange} />);
    expect(view.getByLabelText('State')).toHaveProp('accessibilityValue', { text: 'District of Columbia' });
    fireEvent.press(view.getByLabelText('State'));
    fireEvent.press(view.getByRole('button', { name: 'Close state selection' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a placeholder for an unknown saved state and disables changes during review', () => {
    const onChange = jest.fn();
    const view = render(<StateSelect value="Unknown" onChange={onChange} disabled />);
    expect(view.getByLabelText('State')).toHaveProp('accessibilityValue', { text: 'Select a state' });
    expect(view.getByLabelText('State')).toBeDisabled();
    fireEvent.press(view.getByLabelText('State'));
    expect(view.queryByRole('radio', { name: 'California (CA)' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a standard web select whose option values are full state names', () => {
    const markup = renderToStaticMarkup(<WebStateSelect value="CA" onChange={jest.fn()} />);
    expect(markup).toContain('<select');
    expect(markup).toContain('aria-label="State"');
    expect(markup).toContain('value="California" selected=""');
    expect(markup).toContain('value="Texas"');
    expect(markup).toContain('value="District of Columbia"');
    expect(markup).not.toContain('value="CA"');
    expect(markup.match(/<option /g)).toHaveLength(52);
  });
});
