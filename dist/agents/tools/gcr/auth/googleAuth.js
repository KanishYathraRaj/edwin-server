"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOAuth2Client = createOAuth2Client;
exports.getAuthUrl = getAuthUrl;
exports.exchangeCodeForTokens = exchangeCodeForTokens;
exports.hasTokens = hasTokens;
exports.getClassroomClient = getClassroomClient;
exports.clearCache = clearCache;
const googleapis_1 = require("googleapis");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const TOKEN_PATH = path_1.default.join(__dirname, "tokens.json");
const CREDENTIALS_PATH = path_1.default.join(__dirname, "..", "credentials.json");
// Google Classroom API scopes
const SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
];
let cachedClient = null;
/**
 * Load OAuth2 credentials from credentials.json
 */
async function loadCredentials() {
    const content = await promises_1.default.readFile(CREDENTIALS_PATH, "utf8");
    const credentials = JSON.parse(content);
    const { client_id, client_secret, redirect_uris } = credentials.web;
    return { client_id, client_secret, redirect_uris };
}
/**
 * Create OAuth2 client
 */
async function createOAuth2Client() {
    const { client_id, client_secret, redirect_uris } = await loadCredentials();
    return new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}
/**
 * Generate authorization URL
 */
async function getAuthUrl() {
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
async function exchangeCodeForTokens(code) {
    const oAuth2Client = await createOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    // Save tokens for future use
    await promises_1.default.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    return tokens;
}
/**
 * Check if tokens exist
 */
async function hasTokens() {
    try {
        await promises_1.default.access(TOKEN_PATH);
        return true;
    }
    catch (_a) {
        return false;
    }
}
/**
 * Load existing tokens from file
 */
async function loadToken() {
    try {
        const content = await promises_1.default.readFile(TOKEN_PATH, "utf8");
        return JSON.parse(content);
    }
    catch (error) {
        return null;
    }
}
/**
 * Get authenticated Google Classroom client
 * Throws error if tokens don't exist
 */
async function getClassroomClient() {
    if (cachedClient)
        return cachedClient;
    const token = await loadToken();
    if (!token) {
        throw new Error("No authentication tokens found. Please authenticate first by visiting /auth/google");
    }
    const oAuth2Client = await createOAuth2Client();
    oAuth2Client.setCredentials(token);
    cachedClient = googleapis_1.google.classroom({
        version: "v1",
        auth: oAuth2Client,
    });
    return cachedClient;
}
/**
 * Clear cached client (useful for testing)
 */
function clearCache() {
    cachedClient = null;
}
