
import { SettingsModel } from '../models/Settings';

interface SendOtpResponse {
  success: boolean;
  verificationId?: string;
  message?: string;
}

interface VerifyOtpResponse {
  success: boolean;
  message?: string;
}

export class MessageCentralService {
  /**
   * Load and validate MessageCentral settings from the database.
   * Throws a descriptive error if OTP is disabled or credentials are missing.
   */
  private async getSettings() {
    const settings = await SettingsModel.findOne().lean();
    if (!settings) {
      throw new Error('Platform settings not found.');
    }
    if (!settings.otpEnabled) {
      throw new Error('OTP Gateway is disabled. Enable it in Admin → Settings → Message Gateway.');
    }
    if (!settings.customerId || !settings.authToken || !settings.baseUrl) {
      throw new Error(
        'MessageCentral credentials are not fully configured. ' +
        'Please set Customer ID, Auth Token, and Base URL in Admin → Settings → Message Gateway.'
      );
    }
    return settings;
  }

  /**
   * Authenticate with MessageCentral and return the authToken.
   * If the user provided a JWT authToken directly (e.g. from the MessageCentral console,
   * starting with "eyJ" or long token), it is used directly.
   * Otherwise, if an API key/password is provided, we fetch a session token via GET /auth/v1/authentication/token.
   */
  private async getSessionToken(baseUrl: string, customerId: string, apiKeyOrToken: string): Promise<string> {
    const trimmed = (apiKeyOrToken || '').trim();
    if (!trimmed) {
      throw new Error('Auth Token is missing in settings.');
    }

    // Direct JWT authToken (e.g. pasted directly from MessageCentral console)
    if (trimmed.startsWith('eyJ') || trimmed.length > 60) {
      return trimmed;
    }

    // MessageCentral requires the API key to be base64-encoded
    const encodedKey = Buffer.from(trimmed).toString('base64');
    const url = `${baseUrl}/auth/v1/authentication/token?customerId=${encodeURIComponent(customerId)}&key=${encodedKey}&scope=NEW`;

    // MessageCentral documentation specifies GET request
    let res = await fetch(url, { method: 'GET', headers: { accept: '*/*' } });
    if (!res.ok) {
      // Fallback try POST if GET failed
      res = await fetch(url, { method: 'POST', headers: { accept: '*/*' } });
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      throw new Error(body.message || `MessageCentral authentication failed (HTTP ${res.status})`);
    }
    const data = await res.json() as any;
    if (!data.token) {
      throw new Error('MessageCentral did not return an authentication token. Check your Customer ID and Auth Token.');
    }
    return data.token as string;
  }

  /**
   * Send an OTP to the given 10-digit mobile number.
   * Uses MessageCentral V3 Verification API.
   */
  async sendOtp(mobileNumber: string): Promise<SendOtpResponse> {
    let settings: Awaited<ReturnType<typeof this.getSettings>>;
    try {
      settings = await this.getSettings();
    } catch (err: any) {
      return { success: false, message: err.message };
    }

    let sessionToken: string;
    try {
      sessionToken = await this.getSessionToken(settings.baseUrl, settings.customerId, settings.authToken);
    } catch (err: any) {
      console.error('[MessageCentral] Auth error:', err.message);
      return { success: false, message: err.message };
    }

    const cleanBaseUrl = (settings.baseUrl || 'https://cpaas.messagecentral.com').replace(/\/+$/, '');
    const url =
      `${cleanBaseUrl}/verification/v3/send` +
      `?countryCode=${encodeURIComponent(settings.countryCode || '91')}` +
      `&customerId=${encodeURIComponent(settings.customerId)}` +
      `&flowType=${encodeURIComponent(settings.flow || 'SMS')}` +
      `&mobileNumber=${encodeURIComponent(mobileNumber)}` +
      `&otpLength=${settings.otpLength || 4}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authToken: sessionToken,
        accept: '*/*',
      },
    });

    const data = await res.json().catch(() => ({})) as any;

    if (!res.ok || (data.responseCode && Number(data.responseCode) !== 200)) {
      console.error('[MessageCentral] Send OTP error:', JSON.stringify(data));
      const errMsg =
        data.data?.errorMessage ||
        data.errorMessage ||
        data.message ||
        data.data?.message ||
        data.responseDescription ||
        data.error ||
        `MessageCentral Error (HTTP ${res.status})`;
      return { success: false, message: errMsg };
    }

    const verificationId: string | undefined = data.data?.verificationId || data.verificationId;
    if (!verificationId) {
      return { success: false, message: data.data?.errorMessage || data.message || 'MessageCentral did not return a verification ID.' };
    }

    return {
      success: true,
      verificationId,
      message: 'OTP sent successfully.',
    };
  }

  /**
   * Verify an OTP code against a verificationId returned by sendOtp.
   * Uses MessageCentral V3 Verification API.
   */
  async verifyOtp(verificationId: string | undefined, code: string): Promise<VerifyOtpResponse> {
    if (!verificationId) {
      return { success: false, message: 'Verification ID is missing. Please request a new OTP.' };
    }

    let settings: Awaited<ReturnType<typeof this.getSettings>>;
    try {
      settings = await this.getSettings();
    } catch (err: any) {
      return { success: false, message: err.message };
    }

    let sessionToken: string;
    try {
      sessionToken = await this.getSessionToken(settings.baseUrl, settings.customerId, settings.authToken);
    } catch (err: any) {
      console.error('[MessageCentral] Auth error during verify:', err.message);
      return { success: false, message: err.message };
    }

    const cleanBaseUrl = (settings.baseUrl || 'https://cpaas.messagecentral.com').replace(/\/+$/, '');
    const url =
      `${cleanBaseUrl}/verification/v3/validateOtp` +
      `?customerId=${encodeURIComponent(settings.customerId)}` +
      `&verificationId=${encodeURIComponent(verificationId)}` +
      `&code=${encodeURIComponent(code)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        authToken: sessionToken,
        accept: '*/*',
      },
    });

    const data = await res.json().catch(() => ({})) as any;

    if (!res.ok || (data.responseCode && Number(data.responseCode) !== 200)) {
      console.error('[MessageCentral] Verify OTP error:', JSON.stringify(data));
      const errMsg =
        data.data?.errorMessage ||
        data.errorMessage ||
        data.message ||
        data.data?.message ||
        data.responseDescription ||
        data.error ||
        'Invalid OTP. Please try again.';
      return { success: false, message: errMsg };
    }

    const verificationStatus = data.data?.verificationStatus || data.verificationStatus;
    if (verificationStatus !== 'VERIFICATION_COMPLETED' && verificationStatus !== 'SUCCESS') {
      return { success: false, message: data.data?.errorMessage || data.message || 'OTP verification failed. Please try again.' };
    }

    return { success: true, message: 'OTP verified successfully.' };
  }
}
