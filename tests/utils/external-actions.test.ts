import { buildEmailLink, buildMapLink } from '@/utils/external-actions';

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

describe('buildMapLink', () => {
  it('builds a map link for the current platform', () => {
    expect(buildMapLink('123 Main St, Los Angeles, CA 90001')).toBe(
      'http://maps.apple.com/?q=123%20Main%20St%2C%20Los%20Angeles%2C%20CA%2090001'
    );
  });
});
