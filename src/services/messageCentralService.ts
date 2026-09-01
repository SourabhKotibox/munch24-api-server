
interface SendOtpResponse {
  success: boolean;
  verificationId?: string;
  message?: string;
}

interface VerifyOtpResponse {
  success: boolean;
  message?: string;
}

const STATIC_OTP = '1234';
const STATIC_VERIFICATION_ID = 'static-otp-verification';

export class MessageCentralService {
  async sendOtp(mobileNumber: string): Promise<SendOtpResponse> {
    console.log(`Static OTP requested for ${mobileNumber}. Use ${STATIC_OTP}.`);
    return {
      success: true,
      message: `OTP sent successfully. Use ${STATIC_OTP} as OTP`,
    };
  }

  async verifyOtp(verificationId: string | undefined, code: string): Promise<VerifyOtpResponse> {
    const isValidVerificationId =
      !verificationId || verificationId === STATIC_VERIFICATION_ID;

    if (isValidVerificationId && code === STATIC_OTP) {
      return {
        success: true,
        message: 'OTP verified successfully',
      };
    }

    return {
      success: false,
      message: `Invalid OTP. Use ${STATIC_OTP}`,
    };
  }
}
