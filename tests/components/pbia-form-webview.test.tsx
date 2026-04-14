import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { PbiaFormWebView } from '@/components/pbia-form-webview';

const mockAppendPbiaWebViewDiagnostic = jest.fn(() => Promise.resolve());
const mockStartPbiaWebViewSession = jest.fn(() =>
  Promise.resolve({
    sessionId: 'session-1',
  })
);
const mockTouchPbiaWebViewSessionHeartbeat = jest.fn(() => Promise.resolve());
const mockEndPbiaWebViewSession = jest.fn(() => Promise.resolve());

const mockWebViewState: { props: Record<string, unknown> | null } = { props: null };

jest.mock('@/services/pbia-webview-diagnostics', () => ({
  appendPbiaWebViewDiagnostic: (...args: unknown[]) => mockAppendPbiaWebViewDiagnostic(...args),
  startPbiaWebViewSession: (...args: unknown[]) => mockStartPbiaWebViewSession(...args),
  touchPbiaWebViewSessionHeartbeat: (...args: unknown[]) =>
    mockTouchPbiaWebViewSessionHeartbeat(...args),
  endPbiaWebViewSession: (...args: unknown[]) => mockEndPbiaWebViewSession(...args),
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    WebView: (props: Record<string, unknown>) => {
      mockWebViewState.props = props;
      return <View testID="mock-webview" />;
    },
  };
});

describe('PbiaFormWebView', () => {
  beforeEach(() => {
    mockWebViewState.props = null;
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the initial PBIA form URL and starts a diagnostics session', async () => {
    render(
      <PbiaFormWebView
        form={{ slug: 'contact', title: 'Contact Us', path: '/forms/contact' }}
        instanceId="instance-123"
      />
    );

    await waitFor(() => expect(mockStartPbiaWebViewSession).toHaveBeenCalled());

    expect(mockWebViewState.props?.source).toEqual({
      uri: 'https://pbia-form-app.vercel.app/forms/contact?embed=true&instance=instance-123',
    });
    expect(mockStartPbiaWebViewSession).toHaveBeenCalledWith(
      'contact',
      'https://pbia-form-app.vercel.app/forms/contact?embed=true&instance=instance-123'
    );
  });

  it('applies bridge navigation messages to same-origin PBIA URLs', async () => {
    render(
      <PbiaFormWebView
        form={{ slug: 'contact', title: 'Contact Us', path: '/forms/contact' }}
        instanceId="instance-123"
        enableMessageBridge
      />
    );

    await waitFor(() => expect(mockWebViewState.props?.onMessage).toBeDefined());

    await act(async () => {
      await (
        mockWebViewState.props?.onMessage as (event: { nativeEvent: { data: string } }) => void
      )({
        nativeEvent: {
          data: JSON.stringify({
            type: 'navigate',
            path: '/forms/contact/follow-up',
          }),
        },
      });
    });

    expect(mockWebViewState.props?.source).toEqual({
      uri: 'https://pbia-form-app.vercel.app/forms/contact/follow-up?embed=true&instance=instance-123',
    });
  });

  it('shows retry UI after a webview load failure and remounts on retry', async () => {
    const { getByText } = render(
      <PbiaFormWebView
        form={{ slug: 'contact', title: 'Contact Us', path: '/forms/contact' }}
        instanceId="instance-123"
      />
    );

    await act(async () => {
      await (mockWebViewState.props?.onError as (event: {
        nativeEvent: { url: string; domain: string; code: number; description: string };
      }) => void)({
        nativeEvent: {
          url: 'https://pbia-form-app.vercel.app/forms/contact',
          domain: 'PBIA',
          code: 500,
          description: 'Broken',
        },
      });
    });

    expect(getByText('Unable to load form')).toBeTruthy();

    fireEvent.press(getByText('Retry'));

    await waitFor(() =>
      expect(mockWebViewState.props?.source).toEqual({
        uri: 'https://pbia-form-app.vercel.app/forms/contact?embed=true&instance=instance-123',
      })
    );
  });
});
