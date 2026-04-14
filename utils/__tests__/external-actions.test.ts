import { buildEmailLink } from '@/utils/external-actions';

describe('buildEmailLink', () => {
  it('builds a simple mailto link when no options are provided', () => {
    expect(buildEmailLink('Support@InsureProBuilders.com')).toBe(
      'mailto:support@insureprobuilders.com'
    );
  });

  it('includes optional subject and body query params for support requests', () => {
    expect(
      buildEmailLink('support@insureprobuilders.com', {
        subject: 'Request COI',
        body: 'Hello Support,\nPlease help.',
      })
    ).toBe(
      'mailto:support@insureprobuilders.com?subject=Request+COI&body=Hello+Support%2C%0APlease+help.'
    );
  });
});
