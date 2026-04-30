import { Injectable } from '@nestjs/common';
import { ZohoAuthService } from './zoho-auth.service';
import { ZohoService } from '../config/zoho-scope.config';

@Injectable()
export class ZohoHttpService {
  constructor(private auth: ZohoAuthService) {}

  async request(
    method: string,
    url: string,
    service: ZohoService,
    body?: any,
    options?: { responseType?: 'json' | 'arraybuffer' | 'stream' }, // ✅ NEW (optional)
  ) {
    const token = await this.auth.getValidAccessToken(service);

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // =========================
    // 🖼️ HANDLE IMAGE / BINARY
    // =========================
    if (options?.responseType === 'arraybuffer') {
      const buffer = await res.arrayBuffer();

      if (!res.ok) {
        throw new Error('Zoho image fetch failed');
      }

      return Buffer.from(buffer);
    }

    // =========================
    // 📦 DEFAULT JSON FLOW (UNCHANGED)
    // =========================
    const text = await res.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      console.error('Non-JSON response:', text);
      throw new Error('Zoho returned invalid JSON');
    }

    if (!res.ok) {
      console.error('Zoho API Error:', data || text);
      throw new Error(data?.message || 'Zoho API failed');
    }

    return data;
  }
}