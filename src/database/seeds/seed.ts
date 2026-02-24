import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  const connectionConfig = databaseUrl
    ? { url: databaseUrl, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'bao_gia',
      };

  const dataSource = new DataSource({
    type: 'postgres',
    ...connectionConfig,
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

  // Seed default organization (backwards compatibility)
  const orgRepo = dataSource.getRepository('Organization');
  const existingOrg = await orgRepo.findOne({ where: { id: DEFAULT_ORG_ID } });
  if (!existingOrg) {
    await orgRepo.save({
      id: DEFAULT_ORG_ID,
      name: 'Default Organization',
      slug: 'default',
      description: 'Default organization for backwards compatibility',
      isActive: true,
      plan: 'professional',
      monthlyTokenLimit: 5000000,
    });
    console.log('Default organization seeded');
  }

  // Seed company settings (now per-org)
  const settingsRepo = dataSource.getRepository('CompanySettings');
  const existingSettings = await settingsRepo.count();
  if (existingSettings === 0) {
    await settingsRepo.save({
      organizationId: DEFAULT_ORG_ID,
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

  // Seed admin user + org membership
  const userRepo = dataSource.getRepository('User');
  let adminUser = await userRepo.findOne({ where: { email: 'admin@baogia.vn' } });
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    adminUser = await userRepo.save({
      email: 'admin@baogia.vn',
      password: hashedPassword,
      fullName: 'Admin',
      role: 'admin',
      isActive: true,
    });
    console.log('Admin user seeded (admin@baogia.vn / Password123!)');
  }

  // Ensure admin is member of default org
  const memberRepo = dataSource.getRepository('OrganizationMember');
  const existingMembership = await memberRepo.findOne({
    where: { userId: adminUser.id, organizationId: DEFAULT_ORG_ID },
  });
  if (!existingMembership) {
    await memberRepo.save({
      userId: adminUser.id,
      organizationId: DEFAULT_ORG_ID,
      role: 'owner',
      isActive: true,
    });
    console.log('Admin assigned as owner of default organization');
  }

  // Assign all existing data to default org (backwards compatibility migration)
  console.log('Checking existing data for org assignment...');
  for (const table of ['customers', 'products', 'quotations', 'templates', 'attachments']) {
    try {
      const result = await dataSource.query(
        `UPDATE ${table} SET organization_id = $1 WHERE organization_id IS NULL`,
        [DEFAULT_ORG_ID],
      );
      if (result[1] > 0) {
        console.log(`  ${table}: assigned ${result[1]} records to default org`);
      }
    } catch {
      // Column might not exist yet (first run with synchronize)
    }
  }

  // Seed initial AI prompt versions
  const promptRepo = dataSource.getRepository('AiPromptVersion');
  const existingPrompts = await promptRepo.count();
  if (existingPrompts === 0) {
    await promptRepo.save([
      {
        type: 'extract',
        versionNumber: 1,
        systemPrompt: `You are a specialized document extraction AI for laboratory and medical equipment quotations.

Given a vendor quotation document (PDF, image, or text), extract ALL line items into structured JSON.

Return ONLY valid JSON in this exact format:
{
  "title": "Vendor quotation title or reference number, or null",
  "vendorName": "Vendor/supplier company name, or null",
  "items": [
    {
      "name": "Product/equipment name in original language",
      "description": "Technical specifications and details",
      "unit": "Unit of measure (unit, set, box, piece, etc.)",
      "quantity": 1,
      "unitPrice": 15000.00,
      "currency": "USD",
      "catalogNumber": "Model/catalog number if available",
      "category": "lab|biotech|icu|analytical|general"
    }
  ],
  "notes": "Any delivery, warranty, or general notes from the document",
  "terms": "Payment terms, validity period, etc.",
  "confidence": 0.9,
  "extractionWarnings": ["Any issues encountered during extraction"]
}

Rules:
- Extract EVERY line item, do not skip any
- NEVER invent items not in the document
- Keep original language for product names (do not translate)
- unitPrice must be a number (no currency symbols)
- Set null with warning if data is unclear (do not guess)
- Classify each item into category (lab/biotech/icu/analytical/general)
- Set confidence 0-1 based on extraction quality`,
        userPromptTemplate: 'Extract all quotation items from this vendor document. Follow the JSON format specified in the system prompt exactly.',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        isActive: true,
        changeNotes: 'Initial version — strict JSON extraction with guardrails',
      },
      {
        type: 'translate',
        versionNumber: 1,
        systemPrompt: `You are a professional translator specializing in laboratory and medical equipment terminology.
Translate the given quotation data from its original language to Vietnamese.

Return ONLY valid JSON in the same structure as the input.

Rules:
- Translate product names to Vietnamese but keep model numbers/codes intact
- Keep technical specifications in original format
- Translate units to Vietnamese equivalents (unit→cai, set→bo, box→hop, piece→chiec)
- Do NOT change numeric values (quantity, unitPrice)
- Do NOT change currency codes
- If text is already in Vietnamese, keep it as-is
- Keep brand names untranslated`,
        userPromptTemplate: 'Translate this quotation data to Vietnamese:\n\n{{data}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        isActive: true,
        changeNotes: 'Initial version — with glossary injection support',
      },
      {
        type: 'compare',
        versionNumber: 1,
        systemPrompt: `You are an expert procurement comparison assistant. Compare vendor offerings against customer requirements.

Return ONLY valid JSON with structure: matches[], unmatchedVendorItems[], unmatchedRequirements[], overallScore, summary, budgetAnalysis.

Rules:
- matchScore is 0-1
- NEVER invent specs not in the data
- Be precise about what is met vs unmet
- Budget analysis only if budget is provided`,
        userPromptTemplate: 'Compare vendor items against customer requirements:\n\nVENDOR: {{vendorSpec}}\nREQUIREMENTS: {{customerRequirement}}',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        isActive: true,
        changeNotes: 'Initial version — AI comparison mode',
      },
    ]);
    console.log('AI prompt versions seeded (extract v1, translate v1, compare v1)');
  }

  // Seed sample rule sets for default org
  const ruleRepo = dataSource.getRepository('RuleSet');
  const existingRules = await ruleRepo.count();
  if (existingRules === 0) {
    await ruleRepo.save([
      {
        organizationId: DEFAULT_ORG_ID,
        category: 'general',
        name: 'Default Price Guardrails',
        description: 'Flag items with unusual prices or quantities',
        rules: [
          { field: 'unitPrice', operator: 'gt', value: 10000000, action: 'flag', priority: 1, message: 'Unit price exceeds 10M — requires review' },
          { field: 'quantity', operator: 'gt', value: 10000, action: 'flag', priority: 2, message: 'Quantity exceeds 10,000 — verify with vendor' },
          { field: 'unitPrice', operator: 'eq', value: 0, action: 'flag', priority: 3, message: 'Zero price detected — verify pricing' },
        ],
        isActive: true,
        createdBy: '00000000-0000-0000-0000-000000000000',
      },
    ]);
    console.log('Sample rule sets seeded');
  }

  await dataSource.destroy();
  console.log('Seed completed');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
