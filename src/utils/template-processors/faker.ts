// CHANGELOG: [2025-06-04] - Created modular faker data generation for script templates

import type { FakerType } from "../../@types/utils";

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
  switch (fakerType) {
    case 'randomEmail':
      return generateRandomEmail();
    case 'randomFullName':
      return generateRandomFullName();
    case 'randomUserName':
      return generateRandomUserName();
    default:
      throw new Error(`Unsupported faker type: ${fakerType}`);
  }
}

/**
 * Generates a random email address
 * @returns Random email address
 */
function generateRandomEmail(): string {
  const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
  const username = generateRandomUserName().toLowerCase();
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username}@${domain}`;
}

/**
 * Generates a random full name
 * @returns Random full name
 */
function generateRandomFullName(): string {
  const firstNames = [
    'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'James', 'Emily',
    'Robert', 'Jessica', 'William', 'Ashley', 'Richard', 'Amanda', 'Thomas',
    'Jennifer', 'Charles', 'Melissa', 'Christopher', 'Michelle'
  ];
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
  ];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

/**
 * Generates a random username
 * @returns Random username
 */
function generateRandomUserName(): string {
  const adjectives = [
    'cool', 'smart', 'brave', 'quick', 'happy', 'clever', 'bright', 'swift',
    'bold', 'calm', 'wise', 'kind', 'fair', 'true', 'pure', 'wild', 'free',
    'real', 'warm', 'rich'
  ];
  const nouns = [
    'user', 'player', 'gamer', 'coder', 'ninja', 'wizard', 'hero', 'champion',
    'master', 'expert', 'pro', 'ace', 'star', 'warrior', 'hunter', 'scout',
    'pilot', 'rider', 'builder', 'maker'
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  
  return `${adjective}${noun}${number}`;
}