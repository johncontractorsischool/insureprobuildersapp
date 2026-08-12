import { Redirect } from 'expo-router';

import { DIGITAL_BUSINESS_CARD_ENABLED } from '@/constants/feature-flags';
import PublicDigitalCardScreen from '@/screens/routes/digital-card/public-digital-card-screen';

export default function PublicDigitalCardWebRoute() {
  if (!DIGITAL_BUSINESS_CARD_ENABLED) {
    return <Redirect href="/" />;
  }

  return <PublicDigitalCardScreen />;
}
