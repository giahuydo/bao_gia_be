import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'bao_gia',
    entities: ['src/database/entities/*.entity.ts'],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Database connected');

  // Seed currencies
  const currencyRepo = dataSource.getRepository('Currency');
  const existingCurrencies = await currencyRepo.count();
  if (existingCurrencies === 0) {
    await currencyRepo.save([
      { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', exchangeRate: 1, decimalPlaces: 0, isDefault: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 25000, decimalPlaces: 2, isDefault: false },
      { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 27000, decimalPlaces: 2, isDefault: false },
    ]);
    console.log('Currencies seeded');
  }

  // Seed company settings
  const settingsRepo = dataSource.getRepository('CompanySettings');
  const existingSettings = await settingsRepo.count();
  if (existingSettings === 0) {
    await settingsRepo.save({
      companyName: 'Cong ty TNHH ABC',
      companyNameEn: 'ABC Company Ltd.',
      taxCode: '0123456789',
      address: '123 Nguyen Van Linh, Quan 7, TP.HCM',
      phone: '028 1234 5678',
      email: 'info@abc.com.vn',
      quotationPrefix: 'BG',
      quotationTerms: 'Bao gia co hieu luc 30 ngay ke tu ngay phat hanh.',
      quotationNotes: 'Cam on quy khach da su dung dich vu cua chung toi.',
    });
    console.log('Company settings seeded');
  }

  // Seed admin user
  const userRepo = dataSource.getRepository('User');
  const existingAdmin = await userRepo.findOne({ where: { email: 'admin@baogia.vn' } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await userRepo.save({
      email: 'admin@baogia.vn',
      password: hashedPassword,
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
    });
    console.log('Admin user seeded (admin@baogia.vn / admin123)');
  }

  await dataSource.destroy();
  console.log('Seed completed');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
