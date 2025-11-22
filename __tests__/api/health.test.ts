/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/health/route';

const getResponseJson = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

describe('Health API route', () => {
  it('returns ok status for GET requests', async () => {
    const request = new NextRequest('http://localhost/api/health');
    const response = await GET(request);
    const payload = await getResponseJson(response as unknown as Response);

    expect(payload.status).toBe(200);
    expect(payload.body).toEqual({ status: 'ok', path: '/api/health' });
  });

  it('echoes body for POST requests', async () => {
    const request = new NextRequest('http://localhost/api/health', {
      method: 'POST',
      body: JSON.stringify({ ping: 'pong' }),
    });

    const response = await POST(request);
    const payload = await getResponseJson(response as unknown as Response);

    expect(payload.status).toBe(200);
    expect(payload.body).toEqual({ status: 'received', body: { ping: 'pong' } });
  });
});
