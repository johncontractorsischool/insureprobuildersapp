import { useCallback, useMemo } from 'react';

import { buildPbiaFormUrl, type PbiaFormRegistryItem } from '@/constants/pbia-forms';
import { useAuth } from '@/context/auth-context';
import { useCompanyProfile } from '@/hooks/use-company-profile';
import { getPortalConfig } from '@/services/portal-config';
import type { Policy } from '@/types/policy';
import { buildPbiaFormPrefillParams } from '@/utils/pbia-form-prefill';

type BuildPbiaFormUrlOptions = {
  policy?: Policy | null;
};

export function usePbiaFormUrl() {
  const { customer, userEmail } = useAuth();
  const { cslbLicense } = useCompanyProfile();
  const portalConfig = useMemo(() => getPortalConfig(), []);

  const buildUrl = useCallback(
    (form: PbiaFormRegistryItem, instanceId: string, options?: BuildPbiaFormUrlOptions) =>
      buildPbiaFormUrl(
        form,
        instanceId,
        buildPbiaFormPrefillParams(form.slug, {
          customer,
          userEmail,
          policy: options?.policy,
          cslbLicense,
          fallbackLicenseNumber: portalConfig.company.licenseNumber,
        })
      ),
    [cslbLicense, customer, portalConfig.company.licenseNumber, userEmail]
  );

  return {
    buildUrl,
  };
}
