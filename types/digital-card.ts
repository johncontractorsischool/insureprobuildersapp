export type DigitalCardPrimaryAction = 'quote' | 'call' | 'email';

export type DigitalCardStatus = 'draft' | 'published';

export type DigitalCardTemplateId = 'insurepro-classic';

export type DigitalBusinessCard = {
  id: string;
  ownerId: string;
  slug: string;
  templateId: DigitalCardTemplateId;
  status: DigitalCardStatus;
  imageUrl: string | null;
  fullName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  bio: string;
  serviceArea: string;
  primaryAction: DigitalCardPrimaryAction;
  primaryColor: string;
  cslbLicenseNumber: string;
  licenseClassification: string;
  publishedAt: string | null;
  updatedAt: string;
};

export type DigitalCardDraft = Omit<
  DigitalBusinessCard,
  'id' | 'ownerId' | 'imageUrl' | 'publishedAt' | 'updatedAt'
> & {
  localImageUri: string | null;
  imageUrl: string | null;
};

export type DigitalCardFieldErrors = Partial<Record<keyof DigitalCardDraft, string>>;

export type DigitalCardValidationResult = {
  draft: DigitalCardDraft;
  fieldErrors: DigitalCardFieldErrors;
  summaryError: string | null;
  isValid: boolean;
};
