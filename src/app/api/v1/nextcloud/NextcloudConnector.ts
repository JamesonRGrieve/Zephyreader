import axios, { AxiosInstance } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { DocumentDescriptor } from '~/lib/documents';

export interface NextcloudDocument extends DocumentDescriptor {
  provider: 'nextcloud';
  modifiedTime: string;
  size: number;
  path: string;
}

// fast-xml-parser / WebDAV PROPFIND output is dynamically shaped; model it as a
// recursive node tree so the parsing helpers stay typed without `any`.
type XmlValue = string | number | boolean | null | undefined | XmlValue[] | { [key: string]: XmlValue };
type XmlNode = { [key: string]: XmlValue };

function isXmlNode(value: XmlValue): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class NextcloudConnector {
  private baseUrl: string;
  private username: string;
  private password: string;
  private rootPath: string;
  private httpClient: AxiosInstance;
  private basePathname: string;
  private parser: XMLParser;

  constructor() {
    this.baseUrl = process.env.NEXTCLOUD_BASE_URL || '';
    this.username = process.env.NEXTCLOUD_USERNAME || '';
    this.password = process.env.NEXTCLOUD_PASSWORD || '';
    this.rootPath = process.env.NEXTCLOUD_ROOT_PATH || '/';

    if (!this.baseUrl) {
      throw new Error('NEXTCLOUD_BASE_URL is not configured');
    }

    const baseUrl = new URL(this.baseUrl);
    this.basePathname = baseUrl.pathname.replace(/\/$/, '') || '/';
    this.httpClient = axios.create({
      baseURL: this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`,
      auth: this.username || this.password ? { username: this.username, password: this.password } : undefined,
    });

    this.parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      attributeNamePrefix: '',
    });
  }

  private normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      return `/${path}`;
    }
    return path;
  }

  private parseResponsePayload(data: string): XmlValue {
    const trimmed = data.trim();
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed) as XmlValue;
      } catch (error) {
        console.warn('Unable to parse Nextcloud response as JSON:', error);
      }
    }

    return this.parser.parse(trimmed) as XmlValue;
  }

  private extractString(value: XmlValue): string {
    if (Array.isArray(value)) {
      return this.extractString(value[0]);
    }
    if (isXmlNode(value)) {
      if ('_text' in value) {
        return this.extractString(value._text);
      }
      return '';
    }

    return typeof value === 'string' ? value : '';
  }

  private relativePathFromHref(href: string): string {
    const cleanedHref = href.split('?')[0];
    const hrefPath = cleanedHref.includes('://') ? new URL(cleanedHref).pathname : cleanedHref;
    const decoded = decodeURIComponent(hrefPath);
    if (decoded.startsWith(this.basePathname)) {
      return decoded.slice(this.basePathname.length).replace(/^\/+/, '');
    }
    return decoded.replace(/^\/+/, '');
  }

  private extractResponses(parsed: XmlValue): XmlValue {
    if (!isXmlNode(parsed)) {
      return [];
    }

    const multistatus = parsed.multistatus;
    if (isXmlNode(multistatus) && multistatus.response !== undefined) {
      return multistatus.response;
    }

    const namespaced = parsed['D:multistatus'] || parsed['d:multistatus'];
    const multistatusNode = Array.isArray(namespaced) ? namespaced[0] : namespaced;
    if (isXmlNode(multistatusNode)) {
      const response = multistatusNode['D:response'] || multistatusNode['d:response'] || multistatusNode.response;
      if (response !== undefined) {
        return response;
      }
    }

    return [];
  }

  private mapEntryToDocument(entry: XmlValue): NextcloudDocument | null {
    if (!isXmlNode(entry)) {
      return null;
    }

    const propstatRaw = entry.propstat || entry['D:propstat'];
    const propstat = Array.isArray(propstatRaw) ? propstatRaw[0] : propstatRaw;
    const propRaw = isXmlNode(propstat) ? propstat.prop || propstat['D:prop'] : undefined;
    const prop: XmlNode = isXmlNode(propRaw) ? propRaw : {};
    const resourceTypeRaw = prop.resourcetype || prop['D:resourcetype'];
    const resourceType: XmlNode = isXmlNode(resourceTypeRaw) ? resourceTypeRaw : {};
    const isCollection = Boolean(resourceType.collection !== undefined || resourceType['D:collection'] !== undefined);

    if (isCollection) {
      return null;
    }

    const hrefValue = this.extractString(entry.href || entry['D:href'] || '');
    const relativePath = this.relativePathFromHref(hrefValue);
    const normalizedPath = this.normalizePath(relativePath);

    return {
      id: relativePath,
      name:
        this.extractString(prop.displayname || prop['D:displayname']) || relativePath.split('/').pop() || relativePath,
      modifiedTime: this.extractString(prop.getlastmodified || prop['D:getlastmodified']) || '',
      size: Number(this.extractString(prop.getcontentlength || prop['D:getcontentlength'] || '0')),
      path: normalizedPath,
      provider: 'nextcloud',
      starred: false,
    };
  }

  async listUserDocuments(): Promise<NextcloudDocument[]> {
    const response = await this.httpClient.request({
      method: 'PROPFIND',
      url: this.rootPath,
      headers: { Depth: '1' },
      responseType: 'text',
    });

    const parsed: XmlValue =
      typeof response.data === 'string' ? this.parseResponsePayload(response.data) : (response.data as XmlValue);
    const entries = this.extractResponses(parsed);
    if (!entries) {
      return [];
    }

    const documents = (Array.isArray(entries) ? entries : [entries])
      .map((entry) => this.mapEntryToDocument(entry))
      .filter((doc): doc is NextcloudDocument => Boolean(doc));

    return documents;
  }

  async getUserDocumentMarkdown(documentPath: string): Promise<string> {
    const relativePath = documentPath.replace(/^\/+/, '');
    const response = await this.httpClient.get(relativePath, { responseType: 'text' });
    return response.data;
  }
}
