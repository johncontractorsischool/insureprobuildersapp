import * as Crypto from 'expo-crypto';

import { pbiaRequest } from '@/services/pbia-client';

export type ClientContactMethod = 'CALL' | 'SMS' | 'EMAIL';

export type ClientContactRequestInput = {
  accountId: string;
  policyId?: string;
  callbackNumber: string;
  preferredContactMethod: ClientContactMethod;
  description?: string;
};

export async function createClientContactRequest(
  clientEmail: string,
  input: ClientContactRequestInput,
  idempotencyKey = Crypto.randomUUID()
): Promise<unknown> {
  const accountId = input.accountId.trim();
  const callbackNumber = input.callbackNumber.trim();
  const description = input.description?.trim();
  if (!accountId) throw new Error('A PBIA account id is required for this request.');
  if (!callbackNumber) throw new Error('A callback number is required for this request.');
  if (callbackNumber.length > 32) throw new Error('Callback number must be 32 characters or fewer.');
  if (description && description.length > 2000) {
    throw new Error('Request description must be 2,000 characters or fewer.');
  }

  return pbiaRequest<unknown>(
    '/client/contact-requests',
    {
      method: 'POST',
      clientEmail,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        accountId,
        ...(input.policyId?.trim() ? { policyId: input.policyId.trim() } : {}),
        callbackNumber,
        preferredContactMethod: input.preferredContactMethod,
        ...(description ? { description } : {}),
      }),
    },
    'Unable to submit your request to PBIA.'
  );
}
