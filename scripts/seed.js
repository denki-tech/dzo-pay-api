const mongoose = require('mongoose');
const { config } = require('../config/env');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const FeatureFlag = require('../models/FeatureFlag');
const logger = require('../config/logger');

const seedDatabase = async () => {
  try {
    await mongoose.connect(config.database.uri);
    logger.info('Connected to database for seeding');

    // Create admin user if not exists
    const adminExists = await User.findOne({ email: config.admin.defaultEmail });
    if (!adminExists) {
      await User.create({
        email: config.admin.defaultEmail,
        password: config.admin.defaultPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'superadmin',
        status: 'active',
        emailVerified: true,
        plan: 'enterprise',
      });
      logger.info('Admin user created');
    }

    // Create default feature flags
    const defaultFlags = [
      {
        name: 'New Dashboard UI',
        key: 'new_dashboard_ui',
        description: 'Enable the new dashboard interface',
        enabled: false,
        environment: 'all',
        rolloutPercentage: 10,
        createdBy: adminExists?._id || new mongoose.Types.ObjectId(),
      },
      {
        name: 'Crypto Payments',
        key: 'crypto_payments',
        description: 'Enable cryptocurrency payment support',
        enabled: false,
        environment: 'development',
        allowedPlans: ['pro', 'enterprise'],
        createdBy: adminExists?._id || new mongoose.Types.ObjectId(),
      },
      {
        name: 'Advanced Analytics',
        key: 'advanced_analytics',
        description: 'Enable advanced analytics features',
        enabled: true,
        environment: 'all',
        allowedPlans: ['pro', 'enterprise'],
        createdBy: adminExists?._id || new mongoose.Types.ObjectId(),
      },
      {
        name: 'Bulk Transfers',
        key: 'bulk_transfers',
        description: 'Enable bulk transfer functionality',
        enabled: false,
        environment: 'staging',
        allowedPlans: ['enterprise'],
        createdBy: adminExists?._id || new mongoose.Types.ObjectId(),
      },
    ];

    for (const flag of defaultFlags) {
      const exists = await FeatureFlag.findOne({ key: flag.key });
      if (!exists) {
        await FeatureFlag.create(flag);
        logger.info(`Feature flag created: ${flag.key}`);
      }
    }

    logger.info('Database seeding completed');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
