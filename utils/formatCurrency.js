const currencyFormats = {
  NGN: { symbol: '₦', locale: 'en-NG', decimals: 2 },
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  GHS: { symbol: '₵', locale: 'en-GH', decimals: 2 },
  KES: { symbol: 'KSh', locale: 'en-KE', decimals: 2 },
  ZAR: { symbol: 'R', locale: 'en-ZA', decimals: 2 },
  EUR: { symbol: '€', locale: 'en-EU', decimals: 2 },
  GBP: { symbol: '£', locale: 'en-GB', decimals: 2 },
};

class CurrencyFormatter {
  static format(amount, currency = 'NGN', options = {}) {
    const format = currencyFormats[currency] || currencyFormats.NGN;
    const { symbol = true, compact = false, locale = format.locale } = options;

    let formatted;

    if (compact && amount >= 1000000) {
      formatted = new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount);
    } else {
      formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: format.decimals,
        maximumFractionDigits: format.decimals,
      }).format(amount);
    }

    if (symbol) {
      return `${format.symbol}${formatted}`;
    }

    return formatted;
  }

  static formatWithCode(amount, currency = 'NGN') {
    const formatted = this.format(amount, currency, { symbol: false });
    return `${currency} ${formatted}`;
  }

  static parse(amountString) {
    if (typeof amountString === 'number') return amountString;
    return parseFloat(amountString.replace(/[^0-9.-]/g, ''));
  }

  static convert(amount, fromRate, toRate) {
    if (!fromRate || !toRate || fromRate === 0) return amount;
    return (amount / fromRate) * toRate;
  }

  static getSymbol(currency) {
    return currencyFormats[currency]?.symbol || currency;
  }

  static getSupportedCurrencies() {
    return Object.keys(currencyFormats);
  }

  static isValidCurrency(currency) {
    return currency in currencyFormats;
  }

  static round(amount, currency = 'NGN') {
    const format = currencyFormats[currency] || currencyFormats.NGN;
    const multiplier = Math.pow(10, format.decimals);
    return Math.round(amount * multiplier) / multiplier;
  }
}

module.exports = CurrencyFormatter;
