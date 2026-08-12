import { Redirect } from 'expo-router';

import { DIGITAL_BUSINESS_CARD_ENABLED } from '@/constants/feature-flags';
import DigitalCardScreen from '@/screens/routes/digital-card/digital-card-screen';

export default function DigitalCardRoute() {
  if (!DIGITAL_BUSINESS_CARD_ENABLED) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return <DigitalCardScreen />;
}
