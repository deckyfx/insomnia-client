// CHANGELOG: [2025-06-04] - Created centralized utils type definitions
// CHANGELOG: [2025-06-04] - Added script template parser types and interfaces

/**
 * Represents the parsed environment variables with their proper types
 */
export interface EnvVariables {
  [key: string]: string | number | boolean | null;
}

/**
 * Options for reading environment files
 */
export interface ReadEnvOptions {
  /** The path to the .env file. Defaults to process.cwd()/.env */
  path?: string;
  /** Whether to throw an error if the file doesn't exist. Defaults to false */
  required?: boolean;
}

/**
 * Options for template resolution
 */
export interface TemplateResolverOptions {
  /** Whether to throw an error for undefined variables (default: false) */
  strict?: boolean;
  /** Custom replacement for undefined variables (default: original template) */
  undefinedReplacement?: string;
}

/**
 * Expiry modes for response templates
 */
export type ExpiryMode = 'when-expired' | 'never' | 'no-history' | 'always';

/**
 * Interface for parsed response template
 */
export interface ResponseTemplate {
  requestId: string;
  field: string;
  jsonPath?: string;
  xPath?: string;
  expiryMode?: ExpiryMode;
  maxAge?: number;
  filter?: string;
}

/**
 * Supported faker data types
 */
export type FakerType = 
  | 'guid'
  | 'timestamp'
  | 'isoTimestamp'
  | 'randomUUID'
  | 'randomAlphaNumeric'
  | 'randomBoolean'
  | 'randomInt'
  | 'randomColor'
  | 'randomHexColor'
  | 'randomAbbreviation'
  | 'randomIP'
  | 'randomIPV6'
  | 'randomMACAddress'
  | 'randomPassword'
  | 'randomLocale'
  | 'randomUserAgent'
  | 'randomProtocol'
  | 'randomSemver'
  | 'randomFirstName'
  | 'randomLastName'
  | 'randomFullName'
  | 'randomNamePrefix'
  | 'randomNameSuffix'
  | 'randomJobArea'
  | 'randomJobDescriptor'
  | 'randomJobTitle'
  | 'randomJobType'
  | 'randomPhoneNumber'
  | 'randomPhoneNumberExt'
  | 'randomCity'
  | 'randomStreetName'
  | 'randomStreetAddress'
  | 'randomCountry'
  | 'randomCountryCode'
  | 'randomLatitude'
  | 'randomLongitude'
  | 'randomAvatarImage'
  | 'randomImageUrl'
  | 'randomAbstractImage'
  | 'randomAnimalsImage'
  | 'randomBusinessImage'
  | 'randomCatsImage'
  | 'randomCityImage'
  | 'randomFoodImage'
  | 'randomNightlifeImage'
  | 'randomFashionImage'
  | 'randomPeopleImage'
  | 'randomNatureImage'
  | 'randomSportsImage'
  | 'randomTransportImage'
  | 'randomImageDataUri'
  | 'randomBankAccount'
  | 'randomBankAccountName'
  | 'randomCreditCardMask'
  | 'randomBankAccountBic'
  | 'randomBankAccountIban'
  | 'randomTransactionType'
  | 'randomCurrencyCode'
  | 'randomCurrencyName'
  | 'randomCurrencySymbol'
  | 'randomBitcoin'
  | 'randomCompanyName'
  | 'randomCompanySuffix'
  | 'randomBs'
  | 'randomBsAdjective'
  | 'randomBsBuzz'
  | 'randomBsNoun'
  | 'randomCatchPhrase'
  | 'randomCatchPhraseAdjective'
  | 'randomCatchPhraseDescriptor'
  | 'randomCatchPhraseNoun'
  | 'randomDatabaseColumn'
  | 'randomDatabaseType'
  | 'randomDatabaseCollation'
  | 'randomDatabaseEngine'
  | 'randomDateFuture'
  | 'randomDatePast'
  | 'randomDateRecent'
  | 'randomWeekday'
  | 'randomMonth'
  | 'randomDomainName'
  | 'randomDomainSuffix'
  | 'randomDomainWord'
  | 'randomEmail'
  | 'randomExampleEmail'
  | 'randomUserName'
  | 'randomUrl'
  | 'randomFileName'
  | 'randomFileType'
  | 'randomFileExt'
  | 'randomCommonFileName'
  | 'randomCommonFileType'
  | 'randomCommonFileExt'
  | 'randomFilePath'
  | 'randomDirectoryPath'
  | 'randomMimeType'
  | 'randomPrice'
  | 'randomProduct'
  | 'randomProductAdjective'
  | 'randomProductMaterial'
  | 'randomProductName'
  | 'randomDepartment'
  | 'randomNoun'
  | 'randomVerb'
  | 'randomIngverb'
  | 'randomAdjective'
  | 'randomWord'
  | 'randomWords'
  | 'randomPhrase'
  | 'randomLoremWord'
  | 'randomLoremWords'
  | 'randomLoremSentence'
  | 'randomLoremSentences'
  | 'randomLoremParagraph'
  | 'randomLoremParagraphs'
  | 'randomLoremText'
  | 'randomLoremSlug'
  | 'randomLoremLines';

/**
 * Template types that can be processed
 */
export type TemplateType = 'response' | 'faker';

/**
 * Options for processing script templates
 */
export interface ScriptTemplateOptions {
  /** Whether to cache template results */
  enableCaching?: boolean;
  /** Default cache TTL in seconds */
  defaultCacheTtl?: number;
}