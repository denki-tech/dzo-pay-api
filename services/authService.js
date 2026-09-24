const User = require('../models/User');
const OTP = require('../models/OTP');
const Wallet = require('../models/Wallet');
const Subscription = require('../models/Subscription');
const ApiKey = require('../models/ApiKey');
const AuditLog = require('../models/AuditLog');
const JWTUtil = require('../utils/jwt');
const HashUtil = require('../utils/hashData');
const ReferenceGenerator = require('../utils/generateReference');
const ApiKeyGenerator = require('../utils/generateApiKey');
const OTPGenerator = require('../utils/generateOTP');
const emailService = require('../utils/sendEmail');
const smsService = require('../utils/sendSMS');
const redis = require('../config/redis');
const logger = require('../config/logger');
const { config } = require('../config/env');

class AuthService {
  async register(data) {
    const { email, password, firstName, lastName, phoneNumber, plan, referralCode } = data;

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      plan: plan || 'free',
      status: 'active',
      referralCode: ReferenceGenerator.generateReferralCode(new Date().toISOString()),
    });

    // Handle referral
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        user.referredBy = referrer._id;
        referrer.totalReferrals += 1;
        await referrer.save();
        await user.save();
      }
    }

    // Generate API key
    const apiKeyData = ApiKeyGenerator.generate();
    const hashedKey = ApiKeyGenerator.hashKey(apiKeyData.fullKey);

    await ApiKey.create({
      userId: user._id,
      key: apiKeyData.fullKey,
      name: 'Default API Key',
      prefix: apiKeyData.prefix,
      hashedKey,
      permissions: ['read', 'write'],
      scopes: ['payments', 'wallets', 'transactions'],
    });

    // Create primary wallet
    const wallet = await Wallet.create({
      userId: user._id,
      name: 'Primary Wallet',
      walletReference: ReferenceGenerator.generateWalletReference(),
      virtualAccountNumber: ReferenceGenerator.generateVirtualAccountNumber(),
      currency: 'NGN',
      isDefault: true,
    });

    // Create subscription
    const subscription = await Subscription.create({
      userId: user._id,
      plan: plan || 'free',
      status: 'active',
      price: 0,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for free
    });

    user.subscriptionId = subscription._id;
    await user.save();

    // Send welcome email
    try {
      await emailService.sendTemplate({
        to: user.email,
        template: 'welcome',
        data: {
          firstName: user.firstName,
          email: user.email,
          plan: user.plan,
          apiKey: apiKeyData.prefix + '...',
          verificationUrl: `${config.baseUrl}/api/v1/auth/verify-email?token=${JWTUtil.generatePasswordResetToken(user._id)}`,
        },
      });
    } catch (error) {
      logger.error('Welcome email failed:', error);
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Log audit
    await AuditLog.createLog({
      userId: user._id,
      action: 'user.register',
      category: 'auth',
      description: 'User registered',
      details: { plan, hasReferral: !!referralCode },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    return {
      user: this.sanitizeUser(user),
      wallet: {
        id: wallet._id,
        name: wallet.name,
        virtualAccountNumber: wallet.virtualAccountNumber,
        balance: wallet.balance,
      },
      tokens,
      apiKey: apiKeyData.fullKey,
    };
  }

  async login(data) {
    const { email, password, mfaCode, ipAddress, userAgent, deviceInfo } = data;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new Error(`Account is locked. Try again in ${remainingTime} minutes`);
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      await user.incrementLoginAttempts();
      throw new Error('Invalid email or password');
    }

    // Check MFA
    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new Error('MFA code required');
      }

      const isValidMFA = await this.verifyMFA(user._id, mfaCode);
      if (!isValidMFA) {
        throw new Error('Invalid MFA code');
      }
    }

    // Reset login attempts
    await user.resetLoginAttempts();

    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIp = ipAddress;
    user.lastLoginDevice = deviceInfo;
    await user.save();

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Log audit
    await AuditLog.createLog({
      userId: user._id,
      action: 'user.login',
      category: 'auth',
      description: 'User logged in',
      ipAddress,
      userAgent,
      deviceInfo,
    });

    // Send security alert for new device/IP
    const lastIp = await redis.get(`last_ip:${user._id}`);
    if (lastIp && lastIp !== ipAddress) {
      try {
        await emailService.sendTemplate({
          to: user.email,
          template: 'securityAlert',
          data: {
            firstName: user.firstName,
            event: 'New login from different IP',
            time: new Date().toLocaleString(),
            ipAddress,
            device: deviceInfo,
            securityUrl: `${config.baseUrl}/security`,
          },
        });
      } catch (error) {
        logger.error('Security alert email failed:', error);
      }
    }
    await redis.setex(`last_ip:${user._id}`, 86400, ipAddress);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async refreshToken(refreshToken) {
    const decoded = JWTUtil.verifyRefreshToken(refreshToken);

    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      throw new Error('Invalid refresh token');
    }

    const tokens = this.generateTokens(user);

    return { tokens };
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If an account exists, a reset link has been sent' };
    }

    const token = JWTUtil.generatePasswordResetToken(user._id);

    // Store token in Redis with 1 hour expiry
    await redis.setex(`password_reset:${user._id}`, 3600, token);

    try {
      await emailService.sendTemplate({
        to: user.email,
        template: 'passwordReset',
        data: {
          firstName: user.firstName,
          resetUrl: `${config.baseUrl}/reset-password?token=${token}`,
        },
      });
    } catch (error) {
      logger.error('Password reset email failed:', error);
    }

    return { message: 'If an account exists, a reset link has been sent' };
  }

  async resetPassword(token, newPassword) {
    const decoded = JWTUtil.verifyPasswordResetToken(token);

    const storedToken = await redis.get(`password_reset:${decoded.userId}`);
    if (!storedToken || storedToken !== token) {
      throw new Error('Invalid or expired reset token');
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.password = newPassword;
    await user.save();

    // Invalidate token
    await redis.del(`password_reset:${decoded.userId}`);

    // Log audit
    await AuditLog.createLog({
      userId: user._id,
      action: 'password.change',
      category: 'security',
      description: 'Password reset via token',
    });

    return { message: 'Password reset successful' };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    // Log audit
    await AuditLog.createLog({
      userId: user._id,
      action: 'password.change',
      category: 'security',
      description: 'Password changed by user',
    });

    return { message: 'Password changed successfully' };
  }

  async setupMFA(userId, method) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (method === 'app') {
      const speakeasy = require('speakeasy');
      const secret = speakeasy.generateSecret({
        name: `D-ZO Pay (${user.email})`,
        length: 32,
      });

      user.mfaSecret = secret.base32;
      await user.save();

      const QRCode = require('qrcode');
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        backupCodes: OTPGenerator.generateBackupCodes(5),
      };
    }

    if (method === 'sms' || method === 'email') {
      // Generate and send OTP
      const otp = OTPGenerator.generateNumeric(6);
      await OTP.createOTP({
        userId: user._id,
        code: otp,
        type: 'mfa_setup',
        purpose: `mfa_setup_${method}`,
        channel: method,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      if (method === 'sms' && user.phoneNumber) {
        await smsService.sendOTP({ to: user.phoneNumber, otp });
      } else {
        await emailService.sendTemplate({
          to: user.email,
          template: 'otp',
          data: { firstName: user.firstName, otp, expiryMinutes: 10 },
        });
      }

      return { message: `OTP sent to your ${method}` };
    }

    throw new Error('Invalid MFA method');
  }

  async verifyMFA(userId, code) {
    const user = await User.findById(userId).select('+mfaSecret');
    if (!user || !user.mfaSecret) {
      return false;
    }

    const speakeasy = require('speakeasy');
    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
  }

  async verifyMFASetup(userId, code, method) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (method === 'app') {
      const isValid = await this.verifyMFA(userId, code);
      if (!isValid) {
        throw new Error('Invalid MFA code');
      }
    } else {
      const otp = await OTP.findOne({
        userId: user._id,
        type: 'mfa_setup',
        status: 'active',
      }).sort({ createdAt: -1 });

      if (!otp) {
        throw new Error('No active MFA setup found');
      }

      const result = await otp.verify(code);
      if (!result.valid) {
        throw new Error(result.reason);
      }
    }

    user.mfaEnabled = true;
    await user.save();

    // Log audit
    await AuditLog.createLog({
      userId: user._id,
      action: 'mfa.enable',
      category: 'security',
      description: `MFA enabled via ${method}`,
    });

    return { message: 'MFA enabled successfully' };
  }

  async disableMFA(userId, password, code) {
    const user = await User.findById(userId).select('+password +mfaSecret');
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new Error('Password is incorrect');
    }

    const isValidMFA = await this.verifyMFA(userId, code);
    if (!isValidMFA) {
      throw new Error('Invalid MFA code');
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaBackupCodes = [];
    await user.save();

    // Log audit
    await AuditLog.createLog({
      userId: user._id,
      action: 'mfa.disable',
      category: 'security',
      description: 'MFA disabled',
    });

    return { message: 'MFA disabled successfully' };
  }

  async sendOTP(userId, type, channel) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const otp = OTPGenerator.generateNumeric(6);
    const otpDoc = await OTP.createOTP({
      userId: user._id,
      code: otp,
      type,
      purpose: `${type}_${channel}`,
      channel,
      expiresAt: new Date(Date.now() + config.jobs.otpExpiryMinutes * 60 * 1000),
    });

    if (channel === 'sms' && user.phoneNumber) {
      await smsService.sendOTP({
        to: user.phoneNumber,
        otp,
        expiryMinutes: config.jobs.otpExpiryMinutes,
      });
    } else {
      await emailService.sendTemplate({
        to: user.email,
        template: 'otp',
        data: {
          firstName: user.firstName,
          otp,
          expiryMinutes: config.jobs.otpExpiryMinutes,
        },
      });
    }

    return {
      message: `OTP sent via ${channel}`,
      otpId: otpDoc._id,
      expiresAt: otpDoc.expiresAt,
    };
  }

  async verifyOTP(userId, code, type) {
    const otp = await OTP.findOne({
      userId,
      type,
      status: 'active',
    }).sort({ createdAt: -1 });

    if (!otp) {
      throw new Error('No active OTP found');
    }

    const result = await otp.verify(code);
    if (!result.valid) {
      throw new Error(result.reason);
    }

    return { valid: true, message: 'OTP verified successfully' };
  }

  generateTokens(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    };

    return {
      accessToken: JWTUtil.generateAccessToken(payload),
      refreshToken: JWTUtil.generateRefreshToken({ userId: user._id }),
      expiresIn: config.jwt.expiresIn,
    };
  }

  sanitizeUser(user) {
    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      plan: user.plan,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      mfaEnabled: user.mfaEnabled,
      kycStatus: user.kycStatus,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
  }

  async logout(userId, token) {
    // Blacklist token
    await redis.setex(`blacklist:${token}`, 86400, 'revoked');

    // Log audit
    await AuditLog.createLog({
      userId,
      action: 'user.logout',
      category: 'auth',
      description: 'User logged out',
    });

    return { message: 'Logged out successfully' };
  }

  async impersonateUser(adminId, targetUserId) {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    const token = JWTUtil.generateImpersonationToken(targetUser._id, adminId);

    // Log audit
    await AuditLog.createLog({
      userId: targetUser._id,
      action: 'user.impersonate',
      category: 'admin',
      description: 'Admin impersonated user',
      details: { adminId },
      impersonatedBy: adminId,
    });

    return {
      token,
      user: this.sanitizeUser(targetUser),
      expiresIn: '1h',
    };
  }
}

module.exports = new AuthService();
