const feeStructure = {
  NGN: {
    percentage: 0.015, // 1.5%
    flat: 0,
    cap: 2000, // Max 2000 NGN
    vatRate: 0.075, // 7.5% VAT on fees
  },
  USD: {
    percentage: 0.029, // 2.9%
    flat: 0.30, // $0.30
    cap: null,
    vatRate: 0,
  },
  GHS: {
    percentage: 0.0195, // 1.95%
    flat: 0,
    cap: null,
    vatRate: 0,
  },
  KES: {
    percentage: 0.025, // 2.5%
    flat: 0,
    cap: null,
    vatRate: 0,
  },
  ZAR: {
    percentage: 0.025, // 2.5%
    flat: 0,
    cap: null,
    vatRate: 0,
  },
  EUR: {
    percentage: 0.029, // 2.9%
    flat: 0.30,
    cap: null,
    vatRate: 0,
  },
  GBP: {
    percentage: 0.029, // 2.9%
    flat: 0.30,
    cap: null,
    vatRate: 0,
  },
};

class FeeCalculator {
  static calculate(amount, currency = 'NGN', options = {}) {
    const structure = feeStructure[currency] || feeStructure.NGN;
    const { waiveFee = false, customRate = null, customFlat = null } = options;

    if (waiveFee) {
      return {
        amount,
        fee: 0,
        vat: 0,
        netAmount: amount,
        currency,
      };
    }

    const rate = customRate !== null ? customRate : structure.percentage;
    const flat = customFlat !== null ? customFlat : structure.flat;

    let fee = (amount * rate) + flat;

    // Apply cap if exists
    if (structure.cap && fee > structure.cap) {
      fee = structure.cap;
    }

    // Round to 2 decimal places
    fee = Math.round(fee * 100) / 100;

    // Calculate VAT on fee
    const vat = Math.round(fee * structure.vatRate * 100) / 100;

    const netAmount = amount - fee - vat;

    return {
      amount,
      fee,
      vat,
      netAmount: Math.max(0, netAmount),
      currency,
      breakdown: {
        percentageFee: amount * rate,
        flatFee: flat,
        totalFee: fee,
        vatOnFee: vat,
      },
    };
  }

  static calculateTransferFee(amount, currency = 'NGN', isInternal = false) {
    if (isInternal) {
      return {
        amount,
        fee: 0,
        vat: 0,
        netAmount: amount,
        currency,
      };
    }

    const structure = feeStructure[currency] || feeStructure.NGN;
    const fee = Math.min(amount * 0.005, 50); // 0.5% capped at 50
    const vat = Math.round(fee * structure.vatRate * 100) / 100;

    return {
      amount,
      fee,
      vat,
      netAmount: amount - fee - vat,
      currency,
    };
  }

  static calculateSubscriptionFee(plan, billingCycle = 'monthly') {
    const basePrices = {
      free: 0,
      basic: 5000,
      pro: 15000,
      enterprise: 50000,
    };

    const multipliers = {
      monthly: 1,
      quarterly: 2.7, // 10% discount
      yearly: 9.6, // 20% discount
    };

    const basePrice = basePrices[plan] || 0;
    const multiplier = multipliers[billingCycle] || 1;

    return {
      basePrice,
      billingCycle,
      multiplier,
      totalPrice: Math.round(basePrice * multiplier),
      savings: billingCycle === 'yearly' ? Math.round(basePrice * 12 * 0.2) : 0,
    };
  }

  static getFeeStructure(currency) {
    return feeStructure[currency] || feeStructure.NGN;
  }
}

module.exports = FeeCalculator;
