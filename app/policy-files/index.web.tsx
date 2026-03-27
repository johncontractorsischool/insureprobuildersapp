import PolicyFilesScreen from '@/screens/routes/policy-files/policy-files-screen';
import { WebProtectedShell } from '@/components/web-auth-shell';

export default function PolicyFilesWebRoute() {
  return (
    <WebProtectedShell>
      <PolicyFilesScreen />
    </WebProtectedShell>
  );
}
