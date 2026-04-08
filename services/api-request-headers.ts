const API_KEY_HEADER_NAME = 'x-api-key';

function getPublicApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_X_API_KEY?.trim();
  return apiKey ? apiKey : null;
}

export function withApiKeyHeader(headers: Record<string, string>): Record<string, string> {
  const apiKey = getPublicApiKey();
  if (!apiKey) {
    return headers;
  }

  return {
    ...headers,
    [API_KEY_HEADER_NAME]: apiKey,
  };
}
