const Airtable = require('airtable');
require('dotenv').config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function seedRequests() {
  try {
    console.log('🌱 Seeding demo requests into Airtable...');

    const demoRequests = [
  {
    Name: 'Anirudh Test 1',
    Email: 'anirudh@example.com',
    SlackID: 'U123ABC',
    Description: 'Request for printing a small calibration cube.',
    FileLink: 'https://example.com/testcube.stl',
    Material: 'PLA+',
    DesiredDate: '2025-10-20',
    Country: 'India',
    WeightGrams: 25,
    Notes: 'Test entry for seeding.',
    // ReceivedAt: removed
  },
  {
    Name: 'Anirudh Test 2',
    Email: 'test2@example.com',
    SlackID: 'U456DEF',
    Description: 'Request for keychain design prototype.',
    FileLink: 'https://example.com/keychain.stl',
    Material: 'PETG',
    DesiredDate: '2025-10-22',
    Country: 'USA',
    WeightGrams: 18,
    Notes: 'Needs transparent filament.',
  },
  {
    Name: 'Anirudh Test 3',
    Email: 'test3@example.com',
    SlackID: 'U789GHI',
    Description: 'Request for drone arm part printing.',
    FileLink: 'https://example.com/dronearm.stl',
    Material: 'ABS',
    DesiredDate: '2025-10-25',
    Country: 'Germany',
    WeightGrams: 42,
    Notes: 'High infill required (80%).',
  },
];


    await base(process.env.AIRTABLE_REQUESTS_TABLE_ID).create(
      demoRequests.map((r) => ({ fields: r }))
    );

    console.log('✅ Successfully added 3 demo requests!');
  } catch (error) {
    console.error('❌ Error seeding requests:', error);
  }
}

seedRequests();
