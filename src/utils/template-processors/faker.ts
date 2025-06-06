// CHANGELOG: [2025-06-04] - Created modular faker data generation for script templates

import type { FakerType } from "../../@types/utils";

import { faker } from "@faker-js/faker";

export const fakerFunctions = {
  guid: () => faker.string.uuid(),
  timestamp: () => faker.date.anytime().getTime().toString(),
  isoTimestamp: () => faker.date.anytime().toISOString(),
  randomUUID: () => faker.string.uuid(),
  randomAlphaNumeric: () => faker.string.alphanumeric(),
  randomBoolean: () => faker.datatype.boolean(),
  randomInt: () => faker.number.int(),
  randomColor: () => faker.color.human(),
  randomHexColor: () => faker.internet.color(),
  randomAbbreviation: () => faker.hacker.abbreviation(),
  randomIP: () => faker.internet.ip(),
  randomIPV6: () => faker.internet.ipv6(),
  randomMACAddress: () => faker.internet.mac(),
  randomPassword: () => faker.internet.password(),
  randomLocale: () => faker.location.countryCode(),
  randomUserAgent: () => faker.internet.userAgent(),
  randomProtocol: () => faker.internet.protocol(),
  randomSemver: () => faker.system.semver(),
  randomFirstName: () => faker.person.firstName(),
  randomLastName: () => faker.person.lastName(),
  randomFullName: () => faker.person.fullName(),
  randomNamePrefix: () => faker.person.prefix(),
  randomNameSuffix: () => faker.person.suffix(),
  randomJobArea: () => faker.person.jobArea(),
  randomJobDescriptor: () => faker.person.jobDescriptor(),
  randomJobTitle: () => faker.person.jobTitle(),
  randomJobType: () => faker.person.jobType(),
  randomPhoneNumber: () => faker.phone.number(),
  randomPhoneNumberExt: () => faker.phone.number(),
  randomCity: () => faker.location.city(),
  randomStreetName: () => faker.location.street(),
  randomStreetAddress: () => faker.location.streetAddress(),
  randomCountry: () => faker.location.country(),
  randomCountryCode: () => faker.location.countryCode(),
  randomLatitude: () => faker.location.latitude(),
  randomLongitude: () => faker.location.longitude(),
  randomAvatarImage: () => faker.image.avatar(),
  randomImageUrl: () => faker.image.url(),
  randomAbstractImage: () =>
    faker.image.urlLoremFlickr({ category: "abstract" }),
  randomAnimalsImage: () => faker.image.urlLoremFlickr({ category: "animals" }),
  randomBusinessImage: () =>
    faker.image.urlLoremFlickr({ category: "business" }),
  randomCatsImage: () => faker.image.urlLoremFlickr({ category: "cats" }),
  randomCityImage: () => faker.image.urlLoremFlickr({ category: "city" }),
  randomFoodImage: () => faker.image.urlLoremFlickr({ category: "food" }),
  randomNightlifeImage: () =>
    faker.image.urlLoremFlickr({ category: "nightlife" }),
  randomFashionImage: () => faker.image.urlLoremFlickr({ category: "fashion" }),
  randomPeopleImage: () => faker.image.urlLoremFlickr({ category: "people" }),
  randomNatureImage: () => faker.image.urlLoremFlickr({ category: "nature" }),
  randomSportsImage: () => faker.image.urlLoremFlickr({ category: "sports" }),
  randomTransportImage: () =>
    faker.image.urlLoremFlickr({ category: "transport" }),
  randomImageDataUri: () => faker.image.dataUri(),
  randomBankAccount: () => faker.finance.accountNumber(),
  randomBankAccountName: () => faker.finance.accountName(),
  randomCreditCardMask: () => faker.finance.maskedNumber(),
  randomBankAccountBic: () => faker.finance.bic(),
  randomBankAccountIban: () => faker.finance.iban(),
  randomTransactionType: () => faker.finance.transactionType(),
  randomCurrencyCode: () => faker.finance.currencyCode(),
  randomCurrencyName: () => faker.finance.currencyName(),
  randomCurrencySymbol: () => faker.finance.currencySymbol(),
  randomBitcoin: () => faker.finance.bitcoinAddress(),
  randomCompanyName: () => faker.company.name(),
  randomCompanySuffix: () => faker.company.name(),
  randomBs: () => faker.company.buzzPhrase(),
  randomBsAdjective: () => faker.company.buzzAdjective(),
  randomBsBuzz: () => faker.company.buzzVerb(),
  randomBsNoun: () => faker.company.buzzNoun(),
  randomCatchPhrase: () => faker.company.catchPhrase(),
  randomCatchPhraseAdjective: () => faker.company.catchPhraseAdjective(),
  randomCatchPhraseDescriptor: () => faker.company.catchPhraseDescriptor(),
  randomCatchPhraseNoun: () => faker.company.catchPhraseNoun(),
  randomDatabaseColumn: () => faker.database.column(),
  randomDatabaseType: () => faker.database.type(),
  randomDatabaseCollation: () => faker.database.collation(),
  randomDatabaseEngine: () => faker.database.engine(),
  randomDateFuture: () => faker.date.future().toISOString(),
  randomDatePast: () => faker.date.past().toISOString(),
  randomDateRecent: () => faker.date.recent().toISOString(),
  randomWeekday: () => faker.date.weekday(),
  randomMonth: () => faker.date.month(),
  randomDomainName: () => faker.internet.domainName(),
  randomDomainSuffix: () => faker.internet.domainSuffix(),
  randomDomainWord: () => faker.internet.domainWord(),
  randomEmail: () => faker.internet.email(),
  randomExampleEmail: () => faker.internet.exampleEmail(),
  randomUserName: () => faker.internet.userName(),
  randomUrl: () => faker.internet.url(),
  randomFileName: () => faker.system.fileName(),
  randomFileType: () => faker.system.fileType(),
  randomFileExt: () => faker.system.fileExt(),
  randomCommonFileName: () => faker.system.commonFileName(),
  randomCommonFileType: () => faker.system.commonFileType(),
  randomCommonFileExt: () => faker.system.commonFileExt(),
  randomFilePath: () => faker.system.filePath(),
  randomDirectoryPath: () => faker.system.directoryPath(),
  randomMimeType: () => faker.system.mimeType(),
  randomPrice: () => faker.commerce.price(),
  randomProduct: () => faker.commerce.product(),
  randomProductAdjective: () => faker.commerce.productAdjective(),
  randomProductMaterial: () => faker.commerce.productMaterial(),
  randomProductName: () => faker.commerce.productName(),
  randomDepartment: () => faker.commerce.department(),
  randomNoun: () => faker.hacker.noun(),
  randomVerb: () => faker.hacker.verb(),
  randomIngverb: () => faker.hacker.ingverb(),
  randomAdjective: () => faker.hacker.adjective(),
  randomWord: () => faker.hacker.noun(),
  randomWords: () => faker.lorem.words(),
  randomPhrase: () => faker.hacker.phrase(),
  randomLoremWord: () => faker.lorem.word(),
  randomLoremWords: () => faker.lorem.words(),
  randomLoremSentence: () => faker.lorem.sentence(),
  randomLoremSentences: () => faker.lorem.sentences(),
  randomLoremParagraph: () => faker.lorem.paragraph(),
  randomLoremParagraphs: () => faker.lorem.paragraphs(),
  randomLoremText: () => faker.lorem.text(),
  randomLoremSlug: () => faker.lorem.slug(),
  randomLoremLines: () => faker.lorem.lines(),
};

/**
 * Processes a faker template with parsed arguments
 * @param args - Array of template arguments starting with 'faker'
 * @returns The generated fake data as string
 * @example
 * ```typescript
 * processFakerTemplate(["faker", "randomEmail"])
 * // Returns: "john.doe@example.com"
 * ```
 */
export function processFakerTemplate(args: string[]): string {
  // args[0] should be 'faker'
  // args[1] should be the faker type (e.g., 'randomEmail', 'randomFullName', 'randomUserName')

  if (args.length < 2) {
    throw new Error(
      `Invalid faker template: expected at least 2 arguments, got ${args.length}`
    );
  }

  const fakerType = args[1] as FakerType;

  if (!fakerType) {
    throw new Error(`Invalid faker template: faker type is required`);
  }

  return generateFakeData(fakerType);
}

/**
 * Generates fake data based on the specified type
 * @param fakerType - The type of fake data to generate
 * @returns Generated fake data as string
 * @example
 * ```typescript
 * generateFakeData('randomEmail')
 * // Returns: "user123@example.com"
 * ```
 */
export function generateFakeData(fakerType: FakerType): string {
  // Check if the faker function exists in our fakerFunctions object
  const fakerFunction = fakerFunctions[fakerType];
  
  if (!fakerFunction) {
    throw new Error(`Unsupported faker type: ${fakerType}`);
  }
  
  // Call the faker function and return the result as string
  return String(fakerFunction());
}

