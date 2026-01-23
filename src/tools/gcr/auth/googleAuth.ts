import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";

const TOKEN_PATH = path.join(__dirname, "tokens.json");
const CREDENTIALS_PATH = path.join(__dirname, "..", "credentials.json");

// Google Classroom API scopes
const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
];

let cachedClient: any = null;

/**
 * Load OAuth2 credentials from credentials.json
 */
async function loadCredentials() {
  const content = await fs.readFile(CREDENTIALS_PATH, "utf8");
  const credentials = JSON.parse(content);
  const { client_id, client_secret, redirect_uris } = credentials.web;
  return { client_id, client_secret, redirect_uris };
}

/**
 * Create OAuth2 client
 */
export async function createOAuth2Client() {
  const { client_id, client_secret, redirect_uris } = await loadCredentials();
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

/**
 * Generate authorization URL
 */
export async function getAuthUrl() {
  const oAuth2Client = await createOAuth2Client();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent screen to ensure refresh token is returned
  });
}

/**
 * Exchange authorization code for tokens and save them
 */
export async function exchangeCodeForTokens(code: string) {
  const oAuth2Client = await createOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);

  // Save tokens for future use
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  return tokens;
}

/**
 * Check if tokens exist
 */
export async function hasTokens(): Promise<boolean> {
  try {
    await fs.access(TOKEN_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load existing tokens from file
 */
async function loadToken(): Promise<any | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, "utf8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Get authenticated Google Classroom client
 * Throws error if tokens don't exist
 */
export async function getClassroomClient() {
  if (cachedClient) return cachedClient;

  const token = await loadToken();

  if (!token) {
    throw new Error(
      "No authentication tokens found. Please authenticate first by visiting /auth/google"
    );
  }

  const oAuth2Client = await createOAuth2Client();
  oAuth2Client.setCredentials(token);

  cachedClient = google.classroom({
    version: "v1",
    auth: oAuth2Client,
  });

  return cachedClient;
}

/**
 * Clear cached client (useful for testing)
 */
export function clearCache() {
  cachedClient = null;
}
