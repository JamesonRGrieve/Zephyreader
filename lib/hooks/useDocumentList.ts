import axios from 'axios';
import useSWR from 'swr';
import { DocumentDescriptor } from '@/lib/documents';

type Provider = DocumentDescriptor['provider'];

type ProviderConfig = {
  endpoint: string;
  provider: Provider;
};

const providerConfig: Record<Provider, ProviderConfig> = {
  google: {
    endpoint: '/v1/google/docs/list',
    provider: 'google',
  },
  nextcloud: {
    endpoint: '/v1/nextcloud/docs/list',
    provider: 'nextcloud',
  },
};

async function fetchDocuments(provider: Provider, authHeader: string): Promise<DocumentDescriptor[]> {
  const config = providerConfig[provider];
  const response = await axios.get(
    `${process.env.NEXT_PUBLIC_AUTH_SERVER}${config.endpoint}`,
    authHeader
      ? {
          headers: {
            Authorization: authHeader,
          },
        }
      : undefined,
  );

  const docs = response.data as DocumentDescriptor[];
  return docs.map((doc) => ({ ...doc, provider: config.provider }));
}

export function useDocumentList(provider: Provider, authHeader: string) {
  return useSWR<DocumentDescriptor[]>(`/documents/${provider}`, () => fetchDocuments(provider, authHeader));
}
