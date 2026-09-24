const nodemailer = require('nodemailer');
const { config } = require('../config/env');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  async send({ to, subject, html, text, from, attachments = [], cc, bcc, replyTo }) {
    try {
      const mailOptions = {
        from: from || config.email.from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
        attachments,
        cc,
        bcc,
        replyTo,
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: mailOptions.to,
        subject,
      });

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl?.(info),
      };
    } catch (error) {
      logger.error('Email sending failed:', {
        error: error.message,
        to,
        subject,
      });
      throw error;
    }
  }

  async sendTemplate({ to, template, data, from }) {
    const templates = {
      welcome: this.getWelcomeTemplate,
      otp: this.getOTPTemplate,
      transaction: this.getTransactionTemplate,
      passwordReset: this.getPasswordResetTemplate,
      securityAlert: this.getSecurityAlertTemplate,
      paymentReceipt: this.getPaymentReceiptTemplate,
      subscriptionRenewal: this.getSubscriptionRenewalTemplate,
      kycApproved: this.getKYCApprovedTemplate,
      kycRejected: this.getKYCRejectedTemplate,
      accountSuspended: this.getAccountSuspendedTemplate,
      referralBonus: this.getReferralBonusTemplate,
    };

    const templateFn = templates[template];
    if (!templateFn) {
      throw new Error(`Template '${template}' not found`);
    }

    const { subject, html } = templateFn(data);
    return this.send({ to, subject, html, from });
  }

  getWelcomeTemplate(data) {
    return {
      subject: `Welcome to D-ZO Pay, ${data.firstName}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to D-ZO Pay</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <h2>Hi ${data.firstName},</h2>
            <p>Thank you for joining D-ZO Pay! Your account has been successfully created.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Your Account Details:</h3>
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Plan:</strong> ${data.plan}</p>
              <p><strong>API Key:</strong> ${data.apiKey}</p>
            </div>
            <p>Get started by verifying your email and setting up your wallet.</p>
            <a href="${data.verificationUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Verify Email</a>
          </div>
          <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>© 2024 D-ZO Pay. All rights reserved.</p>
          </div>
        </div>
      `,
    };
  }

  getOTPTemplate(data) {
    return {
      subject: `Your D-ZO Pay Verification Code: ${data.otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verification Code</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>Your verification code is:</p>
            <div style="background: white; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="font-size: 48px; letter-spacing: 10px; color: #1f2937; margin: 0;">${data.otp}</h1>
            </div>
            <p style="color: #6b7280; text-align: center;">This code expires in ${data.expiryMinutes || 10} minutes.</p>
            <p style="color: #ef4444; text-align: center; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          </div>
        </div>
      `,
    };
  }

  getTransactionTemplate(data) {
    const isCredit = data.type === 'credit';
    const color = isCredit ? '#10b981' : '#ef4444';
    const sign = isCredit ? '+' : '-';

    return {
      subject: `${isCredit ? 'Credit' : 'Debit'} Alert: ${sign}${data.currency} ${data.amount}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${color}; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">${isCredit ? 'Money Received' : 'Money Sent'}</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <div style="background: white; padding: 30px; border-radius: 8px; text-align: center;">
              <h2 style="color: ${color}; font-size: 36px; margin: 0;">${sign}${data.currency} ${data.amount}</h2>
              <p style="color: #6b7280; margin-top: 10px;">${data.description}</p>
            </div>
            <div style="margin-top: 20px; background: white; padding: 20px; border-radius: 8px;">
              <p><strong>Reference:</strong> ${data.reference}</p>
              <p><strong>Date:</strong> ${data.date}</p>
              <p><strong>Balance:</strong> ${data.currency} ${data.balance}</p>
            </div>
            <a href="${data.receiptUrl || '#'}`" style="display: inline-block; background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Receipt</a>
          </div>
        </div>
      `,
    };
  }

  getPasswordResetTemplate(data) {
    return {
      subject: 'Reset Your D-ZO Pay Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Password Reset</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            <a href="${data.resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
            <p style="color: #6b7280; font-size: 12px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `,
    };
  }

  getSecurityAlertTemplate(data) {
    return {
      subject: 'Security Alert - D-ZO Pay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ Security Alert</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>We detected a security-related event on your account:</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p><strong>Event:</strong> ${data.event}</p>
              <p><strong>Time:</strong> ${data.time}</p>
              <p><strong>IP Address:</strong> ${data.ipAddress}</p>
              <p><strong>Device:</strong> ${data.device}</p>
            </div>
            <p>If this wasn't you, please secure your account immediately.</p>
            <a href="${data.securityUrl || '#'}`" style="display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Secure Account</a>
          </div>
        </div>
      `,
    };
  }

  getPaymentReceiptTemplate(data) {
    return {
      subject: `Payment Receipt - ${data.reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1f2937; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Payment Receipt</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="text-align: center; color: #10b981;">PAID</h2>
              <div style="border-top: 2px dashed #e5e7eb; margin: 20px 0; padding-top: 20px;">
                <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
                <p><strong>Reference:</strong> ${data.reference}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                <p><strong>Description:</strong> ${data.description}</p>
                <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
              </div>
              <div style="border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 20px;">
                <p><strong>Subtotal:</strong> ${data.currency} ${data.subtotal}</p>
                <p><strong>Fees:</strong> ${data.currency} ${data.fees}</p>
                <p style="font-size: 18px; font-weight: bold;"><strong>Total:</strong> ${data.currency} ${data.total}</p>
              </div>
            </div>
          </div>
        </div>
      `,
    };
  }

  getSubscriptionRenewalTemplate(data) {
    return {
      subject: `Subscription ${data.status === 'renewed' ? 'Renewed' : 'Expiring Soon'} - D-ZO Pay`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #667eea; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Subscription Update</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>Your ${data.plan} plan subscription has been ${data.status}.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Plan:</strong> ${data.plan}</p>
              <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
              <p><strong>Next Billing:</strong> ${data.nextBillingDate}</p>
            </div>
            <a href="${data.manageUrl || '#'}`" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Manage Subscription</a>
          </div>
        </div>
      `,
    };
  }

  getKYCApprovedTemplate(data) {
    return {
      subject: 'KYC Verification Approved - D-ZO Pay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #10b981; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">✅ KYC Approved</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>Great news! Your identity verification has been approved.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p>You now have full access to all features including:</p>
              <ul>
                <li>Higher transaction limits</li>
                <li>International transfers</li>
                <li>Advanced analytics</li>
              </ul>
            </div>
          </div>
        </div>
      `,
    };
  }

  getKYCRejectedTemplate(data) {
    return {
      subject: 'KYC Verification Update - D-ZO Pay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f59e0b; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">KYC Update Required</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>We need additional information to complete your verification.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p><strong>Reason:</strong> ${data.reason}</p>
            </div>
            <a href="${data.resubmitUrl || '#'}`" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Resubmit Documents</a>
          </div>
        </div>
      `,
    };
  }

  getAccountSuspendedTemplate(data) {
    return {
      subject: 'Account Suspended - D-ZO Pay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Account Suspended</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>Your account has been suspended for the following reason:</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p>${data.reason}</p>
            </div>
            <p>If you believe this is an error, please contact our support team.</p>
            <a href="${data.supportUrl || '#'}`" style="display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Contact Support</a>
          </div>
        </div>
      `,
    };
  }

  getReferralBonusTemplate(data) {
    return {
      subject: 'Referral Bonus Received - D-ZO Pay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #8b5cf6; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🎉 Referral Bonus!</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <p>Hi ${data.firstName || 'there'},</p>
            <p>You've received a referral bonus!</p>
            <div style="background: white; padding: 30px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h2 style="color: #8b5cf6; font-size: 36px; margin: 0;">${data.currency} ${data.amount}</h2>
              <p style="color: #6b7280;">For referring ${data.referredUserName}</p>
            </div>
            <p>Total referrals: ${data.totalReferrals}</p>
            <a href="${data.referralUrl || '#'}`" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Invite More Friends</a>
          </div>
        </div>
      `,
    };
  }
}

module.exports = new EmailService();
