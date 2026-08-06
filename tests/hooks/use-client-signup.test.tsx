import { act, renderHook } from '@testing-library/react-native';

import { useClientSignup } from '@/hooks/use-client-signup';

const mockCreateClientSignup = jest.fn();
const mockSendEmailSignInCode = jest.fn();

jest.mock('@/services/client-signup-api', () => ({
  createClientSignup: (...args: unknown[]) => mockCreateClientSignup(...args),
}));

jest.mock('@/services/auth-flow', () => ({
  isOtpRateLimitError: () => false,
  sendEmailSignInCode: (...args: unknown[]) => mockSendEmailSignInCode(...args),
}));

describe('useClientSignup', () => {
  it('verifies ownership of the email before creating the PBIA account', async () => {
    mockSendEmailSignInCode.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientSignup());

    act(() => {
      result.current.updateField('businessName', 'Builder Co');
      result.current.updateField('firstName', 'Jane');
      result.current.updateField('lastName', 'Builder');
      result.current.updateField('email', ' Jane@Example.com ');
      result.current.updateField('addressLine1', '123 Main St');
      result.current.updateField('city', 'Los Angeles');
      result.current.updateField('state', 'ca');
      result.current.updateField('zipCode', '90001');
      result.current.setIdentifierValue('1144038');
    });

    let submission: Awaited<ReturnType<typeof result.current.submit>> = null;
    await act(async () => {
      submission = await result.current.submit();
    });

    expect(mockSendEmailSignInCode).toHaveBeenCalledWith('jane@example.com');
    expect(mockCreateClientSignup).not.toHaveBeenCalled();
    expect(submission).toEqual(
      expect.objectContaining({
        email: 'jane@example.com',
        request: expect.objectContaining({
          legalName: 'Builder Co',
          email: 'jane@example.com',
          licenseNumber: '1144038',
        }),
      })
    );
  });
});
