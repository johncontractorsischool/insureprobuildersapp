export type ContactTopic = 'support' | 'feedback';

export const CONTACT_TOPIC_CONFIG: Record<
  ContactTopic,
  {
    menuLabel: string;
    screenTitle: string;
    subject: string;
    description: string;
    placeholder: string;
    successMessage: string;
  }
> = {
  support: {
    menuLabel: 'Need Support',
    screenTitle: 'Need Support',
    subject: 'Contact Us - Need Support',
    description: 'Tell our team what you need help with and we will follow up.',
    placeholder: 'Describe the issue or request you need help with.',
    successMessage: 'Your support request has been sent.',
  },
  feedback: {
    menuLabel: 'Feedback',
    screenTitle: 'Feedback',
    subject: 'Contact Us - Feedback',
    description: 'Share product feedback or ideas with our team.',
    placeholder: 'Tell us what is working well or what should be improved.',
    successMessage: 'Your feedback has been sent.',
  },
};

export function normalizeContactTopic(value: string | null | undefined): ContactTopic {
  return value === 'feedback' ? 'feedback' : 'support';
}
