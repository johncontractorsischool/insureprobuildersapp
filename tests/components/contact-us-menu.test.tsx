import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
};

jest.mock('expo-router', () => ({
  __esModule: true,
  router: mockRouter,
}));

const { ContactUsMenu } = require('@/components/contact-us-menu');

describe('ContactUsMenu', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('routes to the support contact screen', () => {
    const { getByText } = render(<ContactUsMenu />);

    fireEvent.press(getByText('Contact Us'));
    fireEvent.press(getByText('Need Support'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/contact',
      params: { topic: 'support' },
    });
  });

  it('routes to the feedback contact screen', () => {
    const { getByText } = render(<ContactUsMenu />);

    fireEvent.press(getByText('Contact Us'));
    fireEvent.press(getByText('Feedback'));

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/contact',
      params: { topic: 'feedback' },
    });
  });
});
