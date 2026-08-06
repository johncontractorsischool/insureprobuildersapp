import * as Crypto from 'expo-crypto';

import { pbiaRequest } from '@/services/pbia-client';

export type ClientSignupRequest = {
  legalName: string;
  dba?: string;
  email: string;
  phone?: string;
  status: 'PROSPECT' | 'ACTIVE';
  entityType?: 'SOLE_OWNERSHIP' | 'CORPORATION' | 'PARTNERSHIP' | 'LLC';
  licenseNumber?: string;
  primaryContactFirstName: string;
  primaryContactLastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
};

export function createClientSignup(
  input: ClientSignupRequest,
  idempotencyKey = Crypto.randomUUID()
) {
  return pbiaRequest<unknown>(
    '/client/signup',
    {
      method: 'POST',
      clientEmail: input.email,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(input),
    },
    'Unable to create your PBIA account.'
  );
}
