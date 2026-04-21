// ╔══════════════════════════════════════════════════════════════════╗
// ║          PERSONAL FINANCE TRACKER — Backend (Code.gs)           ║
// ║          v5.0 — Multi-user + Auth + Export/Import               ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// ── IMPORTANT: OAuth scope setup ────────────────────────────────────
// ScriptApp.newTrigger() requires the script.scriptapp scope which is
// NOT automatically granted to Web Apps. Two things are needed:
//
//   1. appsscript.json must list the scope (already done — see the
//      manifest file in this project).
//
//   2. The scope must be ACCEPTED by the script owner before the Web
//      App can create triggers. Run  authorizeReminder()  ONCE from
//      the Apps Script editor (▶ Run button) and accept the new
//      permission prompt. After that, trigger creation works from the
//      web UI without any further steps.
// ─────────────────────────────────────────────────────────────────────

const TRANSACTIONS_SHEET = 'Transactions';
const SETTINGS_SHEET     = 'Settings';
const INCOME_SHEET       = 'Income';
const MASTER_FOLDER_NAME = 'FinTrack Users';
const TOKEN_TTL_MS       = 8 * 60 * 60 * 1000; // 8-hour sessions
const PROP_SECRET        = 'SESSION_SECRET';

// ═══════════════════════════════════════════════════════════════════
//  USER MANAGEMENT & AUTHENTICATION (PropertiesService-based)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get or create the session signing secret
 */
function getOrCreateSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(PROP_SECRET);
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(PROP_SECRET, secret);
  }
  return secret;
}

/**
 * Convert bytes to hex string
 */
function bytesToHex_(bytes) {
  return bytes.map(function(b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

/**
 * Hash password using SHA-256
 */
function hashPassword(password) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return bytesToHex_(rawHash);
}

/**
 * Generate a signed session token
 * Format: email:expiration:signature
 */
function generateToken_(email) {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const data = email + ':' + exp;
  const secret = getOrCreateSecret_();
  const signature = bytesToHex_(
    Utilities.computeHmacSha256Signature(data, secret, Utilities.Charset.UTF_8)
  );
  return email + ':' + exp + ':' + signature;
}

/**
 * Validate session token
 * @returns {string|null} email if valid, null otherwise
 */
function validateToken_(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split(':');
    if (parts.length !== 3) return null;

    const email = parts[0];
    const exp = parts[1];
    const signature = parts[2];

    // Check expiration
    if (isNaN(parseInt(exp, 10)) || Date.now() > parseInt(exp, 10)) {
      return null;
    }

    // Verify signature
    const data = email + ':' + exp;
    const secret = getOrCreateSecret_();
    const expectedSig = bytesToHex_(
      Utilities.computeHmacSha256Signature(data, secret, Utilities.Charset.UTF_8)
    );

    if (signature !== expectedSig) return null;

    return email;
  } catch (e) {
    Logger.log('[validateToken_] ERROR: ' + e);
    return null;
  }
}

/**
 * Get user property key
 */
function getUserPropKey_(email) {
  return 'user_' + email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

/**
 * Get user data from PropertiesService
 */
function getUserData_(email) {
  const props = PropertiesService.getScriptProperties();
  const key = getUserPropKey_(email);
  const data = props.getProperty(key);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch (e) {
    Logger.log('[getUserData_] Parse error: ' + e);
    return null;
  }
}

/**
 * Save user data to PropertiesService
 */
function saveUserData_(email, userData) {
  const props = PropertiesService.getScriptProperties();
  const key = getUserPropKey_(email);
  props.setProperty(key, JSON.stringify(userData));
}

/**
 * Register a new user
 */
function registerUser(email, password) {
  try {
    if (!email || !password) {
      return { success: false, message: 'Email and password are required.' };
    }

    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }

    email = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = getUserData_(email);
    if (existingUser) {
      return { success: false, message: 'Email already registered.' };
    }

    // Create user's data spreadsheet
    const userSpreadsheetId = createUserSpreadsheet(email);

    // Hash password and store user data
    const passwordHash = hashPassword(password);
    const userData = {
      passwordHash: passwordHash,
      spreadsheetId: userSpreadsheetId,
      createdDate: new Date().toISOString(),
      lastLogin: ''
    };

    saveUserData_(email, userData);

    return {
      success: true,
      message: 'Account created successfully! Please login.',
      email: email
    };

  } catch (err) {
    Logger.log('[registerUser] ERROR: ' + err);
    return { success: false, message: 'Registration failed: ' + err.message };
  }
}

/**
 * Login user
 */
function loginUser(email, password) {
  try {
    if (!email || !password) {
      return { success: false, message: 'Email and password are required.' };
    }

    email = email.trim().toLowerCase();
    const passwordHash = hashPassword(password);

    // Get user data
    const userData = getUserData_(email);
    if (!userData) {
      // Add delay to prevent brute force attacks
      Utilities.sleep(600);
      return { success: false, message: 'Invalid email or password.' };
    }

    // Verify password
    if (userData.passwordHash !== passwordHash) {
      Utilities.sleep(600);
      return { success: false, message: 'Invalid email or password.' };
    }

    // Update last login
    userData.lastLogin = new Date().toISOString();
    saveUserData_(email, userData);

    // Generate session token
    const sessionToken = generateToken_(email);

    return {
      success: true,
      message: 'Login successful!',
      sessionToken: sessionToken,
      email: email,
      name: email.split('@')[0]
    };

  } catch (err) {
    Logger.log('[loginUser] ERROR: ' + err);
    return { success: false, message: 'Login failed: ' + err.message };
  }
}

/**
 * Validate session and get user info
 */
function validateSession(sessionToken) {
  try {
    if (!sessionToken) {
      return { success: false, message: 'No session token provided.' };
    }

    // Validate token and extract email
    const email = validateToken_(sessionToken);
    if (!email) {
      return { success: false, message: 'Session expired. Please login again.' };
    }

    // Get user data
    const userData = getUserData_(email);
    if (!userData) {
      return { success: false, message: 'User not found.' };
    }

    return {
      success: true,
      email: email,
      name: email.split('@')[0],
      spreadsheetId: userData.spreadsheetId
    };

  } catch (err) {
    Logger.log('[validateSession] ERROR: ' + err);
    return { success: false, message: 'Session validation failed.' };
  }
}

/**
 * Logout user (token-based, no server action needed)
 */
function logoutUser(sessionToken) {
  try {
    // With HMAC tokens, logout is client-side only
    // Token will expire naturally
    return { success: true, message: 'Logged out successfully.' };
  } catch (err) {
    Logger.log('[logoutUser] ERROR: ' + err);
    return { success: false, message: err.message };
  }
}

/**
 * Get current user's email from session
 */
function getCurrentUserEmail(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session.success) {
    throw new Error(session.message);
  }
  return session.email;
}

/**
 * Update user email
 */
function updateUserEmail(sessionToken, newEmail) {
  try {
    const session = validateSession(sessionToken);
    if (!session.success) return session;

    newEmail = newEmail.trim().toLowerCase();
    const oldEmail = session.email;

    if (oldEmail === newEmail) {
      return { success: false, message: 'New email is the same as current email.' };
    }

    // Check if new email already exists
    const existingUser = getUserData_(newEmail);
    if (existingUser) {
      return { success: false, message: 'Email already in use.' };
    }

    // Get old user data
    const oldUserData = getUserData_(oldEmail);
    if (!oldUserData) {
      return { success: false, message: 'User not found.' };
    }

    // Save under new email
    saveUserData_(newEmail, oldUserData);

    // Delete old email property
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(getUserPropKey_(oldEmail));

    // Generate new token with new email
    const newToken = generateToken_(newEmail);

    return {
      success: true,
      message: 'Email updated successfully!',
      newEmail: newEmail,
      newToken: newToken
    };

  } catch (err) {
    Logger.log('[updateUserEmail] ERROR: ' + err);
    return { success: false, message: err.message };
  }
}

/**
 * Update user password
 */
function updateUserPassword(sessionToken, currentPassword, newPassword) {
  try {
    const session = validateSession(sessionToken);
    if (!session.success) return session;

    if (!currentPassword || !newPassword) {
      return { success: false, message: 'Current and new passwords are required.' };
    }

    if (newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    const email = session.email;
    const userData = getUserData_(email);

    if (!userData) {
      return { success: false, message: 'User not found.' };
    }

    // Verify current password
    const currentPasswordHash = hashPassword(currentPassword);
    if (userData.passwordHash !== currentPasswordHash) {
      return { success: false, message: 'Current password is incorrect.' };
    }

    // Update password
    userData.passwordHash = hashPassword(newPassword);
    saveUserData_(email, userData);

    return { success: true, message: 'Password updated successfully!' };

  } catch (err) {
    Logger.log('[updateUserPassword] ERROR: ' + err);
    return { success: false, message: err.message };
  }
}

/**
 * Get or create user's spreadsheet
 * Returns the spreadsheet ID for the current user
 */
function getUserSpreadsheet(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session.success) {
    throw new Error(session.message);
  }

  const spreadsheetId = session.spreadsheetId;

  try {
    // Verify spreadsheet still exists
    SpreadsheetApp.openById(spreadsheetId);
    return spreadsheetId;
  } catch (e) {
    Logger.log('[getUserSpreadsheet] Spreadsheet not found: ' + spreadsheetId);
    throw new Error('Your data spreadsheet was not found. Please contact support.');
  }
}

/**
 * Create a new spreadsheet for a user in organized folder structure
 */
function createUserSpreadsheet(userEmail) {
  // Get or create master folder
  const rootFolder = DriveApp.getRootFolder();
  let masterFolder;
  const folders = rootFolder.getFoldersByName(MASTER_FOLDER_NAME);

  if (folders.hasNext()) {
    masterFolder = folders.next();
  } else {
    masterFolder = rootFolder.createFolder(MASTER_FOLDER_NAME);
  }

  // Create spreadsheet
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const ss = SpreadsheetApp.create('FinTrack - ' + userEmail + ' - ' + timestamp);
  const ssId = ss.getId();

  // Move to master folder
  const file = DriveApp.getFileById(ssId);
  file.moveTo(masterFolder);

  // Initialize sheets
  initializeSpreadsheetById(ssId);

  Logger.log('[createUserSpreadsheet] Created spreadsheet ' + ssId + ' for ' + userEmail);

  return ssId;
}

// ═══════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════════
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('💰 FinTrack')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ═══════════════════════════════════════════════════════════════════
//  SPREADSHEET HELPERS
// ═══════════════════════════════════════════════════════════════════

// Global variable to store current user's spreadsheet ID
var _currentUserSpreadsheetId = null;

/**
 * Set current user session from token
 */
function setUserSession(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session.success) {
    throw new Error(session.message);
  }
  _currentUserSpreadsheetId = session.spreadsheetId;
  return session;
}

function getSpreadsheet() {
  if (!_currentUserSpreadsheetId) {
    throw new Error('No active session. Please login.');
  }
  return SpreadsheetApp.openById(_currentUserSpreadsheetId);
}

function getOrCreateSheet(name) {
  const ss    = getSpreadsheet();
  const found = ss.getSheetByName(name);
  return found || ss.insertSheet(name);
}

// ═══════════════════════════════════════════════════════════════════
//  TRANSACTION CRUD
// ═══════════════════════════════════════════════════════════════════
function addTransaction(data) {
  try {
    if (!data.date || !data.amount || !data.category)
      return { success: false, message: 'Date, amount and category are required.' };
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0)
      return { success: false, message: 'Amount must be a positive number.' };
    const sheet = getOrCreateSheet(TRANSACTIONS_SHEET);
    sheet.appendRow([new Date(data.date), amount, data.category.trim(),
      data.subcategory ? data.subcategory.trim() : '',
      data.note ? data.note.trim() : '', new Date()]);
    const last = sheet.getLastRow();
    sheet.getRange(last, 1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(last, 2).setNumberFormat('#,##0.00');
    sheet.getRange(last, 6).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    return { success: true, message: 'Transaction saved! ✅' };
  } catch (err) {
    Logger.log('[addTransaction] ERROR: ' + err);
    return { success: false, message: 'Server error: ' + err.message };
  }
}

function getTransactions(month, year) {
  try {
    const sheet = getOrCreateSheet(TRANSACTIONS_SHEET);
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const now = new Date();
    const m   = (month !== undefined) ? month : now.getMonth() + 1;
    const y   = (year  !== undefined) ? year  : now.getFullYear();
    const tz  = Session.getScriptTimeZone();
    const rows = [];
    const filterByDate = (month !== undefined || year !== undefined);

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[0] || !r[1]) continue;
      const d = new Date(r[0]);

      // If month/year provided, filter by them. Otherwise get all.
      if (filterByDate && ((d.getMonth() + 1) !== m || d.getFullYear() !== y)) continue;

      const hasSubcat = r.length >= 6 && r[3] !== undefined;
      rows.push({
        id: i + 1,
        date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
        amount: parseFloat(r[1]) || 0,
        category: String(r[2] || ''),
        subcategory: hasSubcat ? String(r[3] || '') : '',
        note: hasSubcat ? String(r[4] || '') : String(r[3] || ''),
        timestamp: r[5] ? Utilities.formatDate(new Date(r[5]), tz, 'yyyy-MM-dd HH:mm') : ''
      });
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  } catch (err) {
    Logger.log('[getTransactions] ERROR: ' + err);
    return [];
  }
}

/**
 * Get all transactions (no date filter) for export
 */
function getAllTransactions() {
  try {
    const sheet = getOrCreateSheet(TRANSACTIONS_SHEET);
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const tz  = Session.getScriptTimeZone();
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[0] || !r[1]) continue;
      const d = new Date(r[0]);
      const hasSubcat = r.length >= 6 && r[3] !== undefined;
      rows.push({
        id: i + 1,
        date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
        amount: parseFloat(r[1]) || 0,
        category: String(r[2] || ''),
        subcategory: hasSubcat ? String(r[3] || '') : '',
        note: hasSubcat ? String(r[4] || '') : String(r[3] || ''),
        timestamp: r[5] ? Utilities.formatDate(new Date(r[5]), tz, 'yyyy-MM-dd HH:mm') : ''
      });
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  } catch (err) {
    Logger.log('[getAllTransactions] ERROR: ' + err);
    return [];
  }
}

function getTransactionsByDateRange(startDate, endDate) {
  try {
    const sheet = getOrCreateSheet(TRANSACTIONS_SHEET);
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const tz    = Session.getScriptTimeZone();
    const start = new Date(startDate);
    const end   = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[0] || !r[1]) continue;
      const d = new Date(r[0]);
      if (d < start || d > end) continue;
      const hasSubcat = r.length >= 6 && r[3] !== undefined;
      rows.push({
        id: i + 1,
        date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
        amount: parseFloat(r[1]) || 0,
        category: String(r[2] || ''),
        subcategory: hasSubcat ? String(r[3] || '') : '',
        note: hasSubcat ? String(r[4] || '') : String(r[3] || ''),
        timestamp: r[5] ? Utilities.formatDate(new Date(r[5]), tz, 'yyyy-MM-dd HH:mm') : ''
      });
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  } catch (err) {
    Logger.log('[getTransactionsByDateRange] ERROR: ' + err);
    return [];
  }
}

function deleteTransaction(rowIndex) {
  try {
    const sheet = getOrCreateSheet(TRANSACTIONS_SHEET);
    if (rowIndex < 2 || rowIndex > sheet.getLastRow())
      return { success: false, message: 'Invalid row index.' };
    sheet.deleteRow(rowIndex);
    return { success: true, message: 'Transaction deleted.' };
  } catch (err) {
    Logger.log('[deleteTransaction] ERROR: ' + err);
    return { success: false, message: 'Server error: ' + err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EXTRA INCOME CRUD
// ═══════════════════════════════════════════════════════════════════
function addIncomeEntry(data) {
  try {
    if (!data.date || !data.amount || !data.source)
      return { success: false, message: 'Date, amount and source are required.' };
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0)
      return { success: false, message: 'Amount must be a positive number.' };
    const sheet = getOrCreateSheet(INCOME_SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Date', 'Amount', 'Source', 'Note', 'Entry Timestamp']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0f172a').setFontColor('#f8fafc');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([new Date(data.date), amount, data.source.trim(),
      data.note ? data.note.trim() : '', new Date()]);
    const last = sheet.getLastRow();
    sheet.getRange(last, 1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(last, 2).setNumberFormat('#,##0.00');
    sheet.getRange(last, 5).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    return { success: true, message: 'Income entry saved! ✅' };
  } catch (err) {
    Logger.log('[addIncomeEntry] ERROR: ' + err);
    return { success: false, message: 'Server error: ' + err.message };
  }
}

function getIncomeEntries(month, year) {
  try {
    const sheet = getOrCreateSheet(INCOME_SHEET);
    if (sheet.getLastRow() <= 1) return [];
    const data = sheet.getDataRange().getValues();
    const now  = new Date();
    const m    = (month !== undefined) ? month : now.getMonth() + 1;
    const y    = (year  !== undefined) ? year  : now.getFullYear();
    const tz   = Session.getScriptTimeZone();
    const rows = [];
    const filterByDate = (month !== undefined || year !== undefined);

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[0] || !r[1]) continue;
      const d = new Date(r[0]);

      // If month/year provided, filter by them. Otherwise get all.
      if (filterByDate && ((d.getMonth() + 1) !== m || d.getFullYear() !== y)) continue;

      rows.push({
        id: i + 1,
        date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
        amount: parseFloat(r[1]) || 0,
        source: String(r[2] || ''),
        note: String(r[3] || ''),
        timestamp: r[4] ? Utilities.formatDate(new Date(r[4]), tz, 'yyyy-MM-dd HH:mm') : ''
      });
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  } catch (err) {
    Logger.log('[getIncomeEntries] ERROR: ' + err);
    return [];
  }
}

/**
 * Get all income entries (no date filter) for export
 */
function getAllIncomeEntries() {
  try {
    const sheet = getOrCreateSheet(INCOME_SHEET);
    if (sheet.getLastRow() <= 1) return [];
    const data = sheet.getDataRange().getValues();
    const tz   = Session.getScriptTimeZone();
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[0] || !r[1]) continue;
      const d = new Date(r[0]);
      rows.push({
        id: i + 1,
        date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
        amount: parseFloat(r[1]) || 0,
        source: String(r[2] || ''),
        note: String(r[3] || ''),
        timestamp: r[4] ? Utilities.formatDate(new Date(r[4]), tz, 'yyyy-MM-dd HH:mm') : ''
      });
    }
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    return rows;
  } catch (err) {
    Logger.log('[getAllIncomeEntries] ERROR: ' + err);
    return [];
  }
}

function deleteIncomeEntry(rowIndex) {
  try {
    const sheet = getOrCreateSheet(INCOME_SHEET);
    if (rowIndex < 2 || rowIndex > sheet.getLastRow())
      return { success: false, message: 'Invalid row index.' };
    sheet.deleteRow(rowIndex);
    return { success: true, message: 'Income entry deleted.' };
  } catch (err) {
    Logger.log('[deleteIncomeEntry] ERROR: ' + err);
    return { success: false, message: 'Server error: ' + err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════
function getSettings() {
  try {
    const sheet = getOrCreateSheet(SETTINGS_SHEET);
    const data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return _defaultSettings();

    const s = {
      monthlyIncome : 0,
      currency      : 'MYR',
      incomeSources : [],
      categories    : [],
      budgets       : {},
      icons         : {},
      subcategories : {},
      reminder      : { enabled: false, email: '', hour: 20 }
    };

    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[0]) continue;
      const key = String(r[0]).trim();
      switch (key) {
        case 'MONTHLY_INCOME':   s.monthlyIncome = parseFloat(r[1]) || 0; break;
        case 'CURRENCY':         s.currency = String(r[1] || 'MYR'); break;
        case 'INCOME_SOURCE':    if (r[1]) s.incomeSources.push(String(r[1]).trim()); break;
        case 'REMINDER_ENABLED': s.reminder.enabled = String(r[1]).toLowerCase() === 'true'; break;
        case 'REMINDER_EMAIL':   s.reminder.email = String(r[1] || '').trim(); break;
        case 'REMINDER_HOUR':    s.reminder.hour = parseInt(r[1]) || 20; break;
        case 'CATEGORY': {
          const catName   = String(r[1] || '').trim();
          const catBudget = parseFloat(r[2]) || 0;
          const catIcon   = String(r[3] || '📦').trim();
          let subcats = [];
          try   { subcats = r[4] ? JSON.parse(String(r[4])) : []; }
          catch (_) { subcats = r[4] ? String(r[4]).split(',').map(x=>x.trim()).filter(Boolean) : []; }
          if (catName) {
            s.categories.push(catName);
            s.budgets[catName]       = catBudget;
            s.icons[catName]         = catIcon;
            s.subcategories[catName] = subcats;
          }
          break;
        }
      }
    }
    if (!s.incomeSources.length) s.incomeSources = _defaultSettings().incomeSources;
    return s.categories.length ? s : _defaultSettings();
  } catch (err) {
    Logger.log('[getSettings] ERROR: ' + err);
    return _defaultSettings();
  }
}

/**
 * saveSettings — ONLY writes to the spreadsheet. Does NOT touch ScriptApp.
 *
 * Trigger management is handled separately by applyReminderTrigger()
 * to avoid the script.scriptapp permission error in the web UI context.
 */
function saveSettings(data) {
  try {
    const sheet = getOrCreateSheet(SETTINGS_SHEET);
    sheet.clearContents();

    sheet.getRange(1, 1, 1, 5)
      .setValues([['Key', 'Value', 'Budget', 'Icon', 'Subcategories (JSON)']])
      .setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc');

    const rows = [
      ['MONTHLY_INCOME', parseFloat(data.monthlyIncome) || 0, '', '', ''],
      ['CURRENCY',       data.currency || 'MYR',              '', '', '']
    ];

    if (data.reminder) {
      rows.push(['REMINDER_ENABLED', data.reminder.enabled ? 'true' : 'false', '', '', '']);
      rows.push(['REMINDER_EMAIL',   data.reminder.email   || '',               '', '', '']);
      rows.push(['REMINDER_HOUR',    parseInt(data.reminder.hour) || 20,        '', '', '']);
    }

    if (Array.isArray(data.incomeSources)) {
      data.incomeSources.forEach(src => {
        if (src && src.trim()) rows.push(['INCOME_SOURCE', src.trim(), '', '', '']);
      });
    }

    if (Array.isArray(data.categories)) {
      data.categories.forEach(c => {
        const subcats = Array.isArray(c.subcategories) ? c.subcategories : [];
        rows.push(['CATEGORY', c.name, parseFloat(c.budget)||0, c.icon||'📦', JSON.stringify(subcats)]);
      });
    }

    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    sheet.setColumnWidths(1, 5, 140);
    sheet.setColumnWidth(5, 260);

    // ── Trigger setup is intentionally NOT here ──────────────────
    // Call applyReminderTrigger() as a separate step from the UI.
    // This avoids the script.scriptapp scope error during saveSettings.

    return { success: true, message: 'Settings saved! ✅' };
  } catch (err) {
    Logger.log('[saveSettings] ERROR: ' + err);
    return { success: false, message: 'Server error: ' + err.message };
  }
}

function getReminderSettings() {
  const s = getSettings();
  return s.reminder || { enabled: false, email: '', hour: 20 };
}

function _defaultSettings() {
  return {
    monthlyIncome : 5000,
    currency      : 'MYR',
    incomeSources : ['Allowance', 'Bonus', 'Claim', 'Commission', 'Freelance', 'Other'],
    reminder      : { enabled: false, email: '', hour: 20 },
    categories    : ['Food & Dining','Transport','Utilities','Entertainment','Shopping','Health','Education','Loan','Others'],
    budgets       : { 'Food & Dining':800,'Transport':400,'Utilities':300,'Entertainment':200,'Shopping':300,'Health':150,'Education':100,'Loan':1200,'Others':150 },
    icons         : { 'Food & Dining':'🍜','Transport':'🚗','Utilities':'💡','Entertainment':'🎮','Shopping':'🛍️','Health':'❤️','Education':'📚','Loan':'🏦','Others':'📦' },
    subcategories : {
      'Food & Dining':['Breakfast','Lunch','Dinner','Snacks','Groceries'],
      'Transport':['Fuel','Toll','Parking','Grab/Taxi','Public Transport'],
      'Utilities':['Water','Electricity','Internet','Mobile','Gas'],
      'Entertainment':['Streaming','Games','Dining Out','Events','Hobbies'],
      'Shopping':['Clothing','Electronics','Home','Personal Care','Online'],
      'Health':['Medicine','Clinic/Hospital','Supplements','Dental','Optical'],
      'Education':['Tuition','Books','Courses','Stationery','School Fees'],
      'Loan':['Hire Purchase','Mortgage','Personal Loan','Credit Card'],
      'Others':[]
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
//  TRIGGER MANAGEMENT
//
//  These functions use ScriptApp which requires the script.scriptapp
//  OAuth scope. The scope is declared in appsscript.json.
//
//  First-time setup:
//    1. Open Apps Script editor
//    2. Select  authorizeReminder  from the function dropdown
//    3. Click ▶ Run — accept the new permission prompt
//    4. Done. The web UI can now create/remove triggers freely.
// ═══════════════════════════════════════════════════════════════════

/**
 * authorizeReminder — run this ONCE manually from the editor.
 *
 * Its only job is to force the OAuth consent screen so that
 * script.scriptapp permission is permanently granted to this script.
 * After running it once successfully you never need to run it again.
 */
function authorizeReminder() {
  // Accessing ScriptApp triggers the permission prompt on first run.
  const existing = ScriptApp.getProjectTriggers();
  Logger.log('✅ script.scriptapp scope granted. Existing triggers: ' + existing.length);
  SpreadsheetApp.getUi().alert(
    '✅ Authorization successful!\n\n' +
    'The reminder feature is now fully enabled.\n' +
    'Go back to your FinTrack app, turn on the reminder in Settings, and save.'
  );
}

/**
 * applyReminderTrigger — called from the web UI AFTER saveSettings.
 *
 * Creates or removes the daily trigger based on current saved settings.
 * Returns a structured result so the UI can show success/error.
 *
 * @return {{ success:boolean, message:string, triggerActive:boolean }}
 */
function applyReminderTrigger() {
  try {
    const settings = getSettings();
    const reminder = settings.reminder;

    _removeTrigger();   // always clear old trigger first

    if (reminder.enabled && reminder.email) {
      _setupTrigger(reminder.hour);
      return {
        success      : true,
        triggerActive: true,
        message      : '✅ Reminder scheduled — you\'ll receive an email daily at ' + _hourLabel(reminder.hour) + '.'
      };
    } else {
      return {
        success      : true,
        triggerActive: false,
        message      : 'Reminder disabled. No trigger created.'
      };
    }
  } catch (err) {
    Logger.log('[applyReminderTrigger] ERROR: ' + err);

    // Detect the specific scope-missing error so we can show a targeted
    // message in the UI rather than a generic server error.
    const msg = err.message || '';
    if (msg.indexOf('script.scriptapp') !== -1 || msg.indexOf('Required permissions') !== -1) {
      return {
        success      : false,
        triggerActive: false,
        authRequired : true,
        message      : 'NEEDS_AUTH'
      };
    }

    return { success: false, triggerActive: false, message: 'Server error: ' + err.message };
  }
}

/**
 * setupDailyTrigger — kept for backwards compatibility / manual use.
 */
function setupDailyTrigger(hour) {
  try {
    _removeTrigger();
    _setupTrigger(hour);
    return { success: true, message: 'Reminder scheduled for ' + _hourLabel(hour) + ' ✅' };
  } catch (err) {
    Logger.log('[setupDailyTrigger] ERROR: ' + err);
    return { success: false, message: err.message };
  }
}

function removeDailyTrigger() {
  try {
    _removeTrigger();
    return { success: true, message: 'Reminder removed.' };
  } catch (err) {
    Logger.log('[removeDailyTrigger] ERROR: ' + err);
    return { success: false, message: err.message };
  }
}

function _setupTrigger(hour) {
  ScriptApp.newTrigger('sendDailyRemindersToAllUsers')
    .timeBased()
    .everyDays(1)
    .atHour(parseInt(hour) || 20)
    .create();
  Logger.log('[_setupTrigger] Trigger created at hour ' + hour);
}

function _removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const handlerFunc = t.getHandlerFunction();
    if (handlerFunc === 'sendDailyRemindersToAllUsers' || handlerFunc === 'sendDailyReminder') {
      ScriptApp.deleteTrigger(t);
    }
  });
}

function _hourLabel(hour) {
  const h = parseInt(hour) || 0;
  const s = h < 12 ? 'AM' : 'PM';
  const d = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return d + ':00 ' + s;
}

// ═══════════════════════════════════════════════════════════════════
//  DAILY EMAIL REMINDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Send daily reminders to all users who have it enabled
 * This is called by the time-based trigger
 */
function sendDailyRemindersToAllUsers() {
  try {
    Logger.log('[sendDailyRemindersToAllUsers] Starting...');
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    let sentCount = 0;

    // Iterate through all properties to find user data
    Object.keys(allProps).forEach(function(key) {
      if (key.startsWith('user_')) {
        try {
          const userData = JSON.parse(allProps[key]);

          // Set the user's spreadsheet context
          _currentUserSpreadsheetId = userData.spreadsheetId;

          // Get this user's settings
          const settings = getSettings();
          const reminder = settings.reminder;

          // Send reminder if enabled for this user
          if (reminder.enabled && reminder.email) {
            sendDailyReminderForUser(reminder.email, settings);
            sentCount++;
            Logger.log('[sendDailyRemindersToAllUsers] Sent to: ' + reminder.email);
          }
        } catch (err) {
          Logger.log('[sendDailyRemindersToAllUsers] Error processing ' + key + ': ' + err);
        }
      }
    });

    Logger.log('[sendDailyRemindersToAllUsers] Completed. Sent ' + sentCount + ' reminders.');
  } catch (err) {
    Logger.log('[sendDailyRemindersToAllUsers] ERROR: ' + err);
  } finally {
    _currentUserSpreadsheetId = null; // Clean up
  }
}

/**
 * Send daily reminder for current user session
 * Used by the test email button
 */
function sendDailyReminder() {
  try {
    const settings = getSettings();
    const reminder = settings.reminder;
    if (!reminder.enabled || !reminder.email) {
      Logger.log('[sendDailyReminder] Reminder disabled or no email configured.');
      return;
    }

    sendDailyReminderForUser(reminder.email, settings);
  } catch (err) {
    Logger.log('[sendDailyReminder] ERROR: ' + err);
    throw err;
  }
}

/**
 * Core function to send reminder email for specific user settings
 */
function sendDailyReminderForUser(recipientEmail, settings) {
  try {

    const tz       = Session.getScriptTimeZone();
    const now      = new Date();
    const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    const m        = now.getMonth() + 1;
    const y        = now.getFullYear();
    const dayName  = Utilities.formatDate(now, tz, 'EEEE');
    const dateDisp = Utilities.formatDate(now, tz, 'd MMMM yyyy');
    const currency = settings.currency || 'MYR';

    const allTx       = getTransactions(m, y);
    const todayTx     = allTx.filter(t => t.date === todayStr);
    const totalSpent  = allTx.reduce((s, t) => s + t.amount, 0);
    const todaySpent  = todayTx.reduce((s, t) => s + t.amount, 0);
    const totalBudget = Object.values(settings.budgets).reduce((s, b) => s + b, 0);
    const remaining   = totalBudget - totalSpent;
    const pctUsed     = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
    const appUrl      = ScriptApp.getService().getUrl();

    const accentColor = '#003366';
    const goldColor   = '#ffc72c';
    const greenColor  = '#1a8754';
    const redColor    = '#c0392b';
    const remainColor = remaining < 0 ? redColor : greenColor;
    const barColor    = pctUsed >= 100 ? redColor : pctUsed >= 70 ? '#a07700' : greenColor;

    function fmt(v) { return currency + ' ' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    const txRows = todayTx.length > 0
      ? todayTx.slice(0, 8).map(tx => {
          const icon = settings.icons[tx.category] || '📦';
          return `<tr style="border-bottom:1px solid #f0f4f8;">
            <td style="padding:8px 12px;font-size:13px;">${icon} ${_esc(tx.category)}${tx.subcategory ? ' <span style="font-size:11px;color:#a07700;background:#fffbea;padding:1px 6px;border-radius:4px;">' + _esc(tx.subcategory) + '</span>' : ''}</td>
            <td style="padding:8px 12px;font-size:13px;color:#6b8cae;">${tx.note ? _esc(tx.note) : '—'}</td>
            <td style="padding:8px 12px;font-size:13px;font-weight:700;text-align:right;white-space:nowrap;">${fmt(tx.amount)}</td>
          </tr>`;
        }).join('') +
        (todayTx.length > 8 ? `<tr><td colspan="3" style="padding:8px 12px;font-size:12px;color:#6b8cae;text-align:center;">… and ${todayTx.length - 8} more entries today</td></tr>` : '')
      : `<tr><td colspan="3" style="padding:16px 12px;text-align:center;color:#adb5bd;font-size:13px;">No transactions recorded today yet.</td></tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:24px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:${accentColor};border-radius:14px 14px 0 0;padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="display:inline-block;background:${goldColor};color:${accentColor};font-weight:700;font-size:13px;padding:4px 10px;border-radius:6px;">Ft</span>&nbsp;<span style="color:#fff;font-weight:700;font-size:18px;vertical-align:middle;">FinTrack</span></td>
      <td align="right"><span style="color:rgba(255,255,255,.55);font-size:12px;">${dayName}, ${dateDisp}</span></td>
    </tr></table>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:16px 0 4px;">💰 Daily Spending Reminder</h1>
    <p style="color:rgba(255,255,255,.65);font-size:13px;margin:0;">Time to log your expenses for today!</p>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 32px 16px;">
    <p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b8cae;margin:0 0 12px;">Month-to-Date Summary</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="33%" style="padding:0 6px 0 0;"><div style="background:#f6f9fc;border:1px solid #dde3ea;border-radius:10px;padding:14px 16px;border-top:3px solid ${goldColor};"><div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b8cae;margin-bottom:4px;">Total Spent</div><div style="font-size:16px;font-weight:700;color:${accentColor};">${fmt(totalSpent)}</div><div style="font-size:11px;color:#adb5bd;margin-top:2px;">${allTx.length} transaction${allTx.length!==1?'s':''}</div></div></td>
      <td width="33%" style="padding:0 3px;"><div style="background:#f6f9fc;border:1px solid #dde3ea;border-radius:10px;padding:14px 16px;border-top:3px solid ${remainColor};"><div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b8cae;margin-bottom:4px;">Remaining</div><div style="font-size:16px;font-weight:700;color:${remainColor};">${fmt(Math.abs(remaining))}</div><div style="font-size:11px;color:#adb5bd;margin-top:2px;">${remaining<0?'⚠️ Over budget':'✅ Within budget'}</div></div></td>
      <td width="33%" style="padding:0 0 0 6px;"><div style="background:#f6f9fc;border:1px solid #dde3ea;border-radius:10px;padding:14px 16px;border-top:3px solid #7ba7bc;"><div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b8cae;margin-bottom:4px;">Today Spent</div><div style="font-size:16px;font-weight:700;color:${accentColor};">${fmt(todaySpent)}</div><div style="font-size:11px;color:#adb5bd;margin-top:2px;">${todayTx.length} entr${todayTx.length!==1?'ies':'y'} today</div></div></td>
    </tr></table>
    <div style="margin-top:16px;"><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;"><tr><td style="font-size:12px;font-weight:600;color:#2c4a6e;">Budget Usage</td><td align="right" style="font-size:12px;color:#6b8cae;">${fmt(totalSpent)} / ${fmt(totalBudget)}</td><td align="right" style="font-size:12px;font-weight:700;color:${barColor};padding-left:8px;">${pctUsed}%</td></tr></table><div style="background:#dee2e6;border-radius:99px;height:8px;overflow:hidden;"><div style="background:${barColor};height:8px;border-radius:99px;width:${pctUsed}%;"></div></div></div>
  </td></tr>
  <tr><td style="background:#fff;padding:0 32px 24px;">
    <p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b8cae;margin:0 0 10px;"><span style="display:inline-block;width:3px;height:.85em;background:${goldColor};border-radius:2px;margin-right:6px;vertical-align:middle;"></span>Today's Transactions</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde3ea;border-radius:10px;overflow:hidden;">
      <thead><tr style="background:#f6f9fc;"><th style="padding:8px 12px;font-size:11px;font-weight:700;text-align:left;color:#6b8cae;text-transform:uppercase;letter-spacing:.06em;">Category</th><th style="padding:8px 12px;font-size:11px;font-weight:700;text-align:left;color:#6b8cae;text-transform:uppercase;letter-spacing:.06em;">Note</th><th style="padding:8px 12px;font-size:11px;font-weight:700;text-align:right;color:#6b8cae;text-transform:uppercase;letter-spacing:.06em;">Amount</th></tr></thead>
      <tbody>${txRows}</tbody>
    </table>
  </td></tr>
  <tr><td style="background:#fff;padding:0 32px 28px;text-align:center;">
    <a href="${appUrl}" style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 32px;border-radius:9px;">📝 &nbsp;Open FinTrack &amp; Record Expenses</a>
    <p style="font-size:12px;color:#adb5bd;margin:12px 0 0;">Keeping track daily helps you reach your savings goals!</p>
  </td></tr>
  <tr><td style="background:#f6f9fc;border-top:1px solid #dde3ea;border-radius:0 0 14px 14px;padding:16px 32px;text-align:center;">
    <p style="font-size:11px;color:#adb5bd;margin:0;">Sent by FinTrack. To disable, go to <strong>Settings → Reminder</strong> and turn off the toggle.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

    GmailApp.sendEmail(
      recipientEmail,
      '💰 FinTrack — Daily Spending Reminder (' + dateDisp + ')',
      'Hi! Daily FinTrack reminder for ' + dateDisp + '.\n\n'
      + 'Spent: ' + fmt(totalSpent) + ' of ' + fmt(totalBudget) + ' (' + pctUsed + '%).\n'
      + 'Today: ' + fmt(todaySpent) + ' in ' + todayTx.length + ' transaction(s).\n\n'
      + 'Open tracker: ' + appUrl,
      { htmlBody: html, name: 'FinTrack Reminder' }
    );
    Logger.log('[sendDailyReminderForUser] Sent to ' + recipientEmail);
  } catch (err) {
    Logger.log('[sendDailyReminderForUser] ERROR: ' + err);
    throw err;
  }
}

function _esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════════════════════════
//  SESSION-AWARE WRAPPERS
// ═══════════════════════════════════════════════════════════════════

function getDashboardDataWithAuth(sessionToken, month, year) {
  setUserSession(sessionToken);
  return getDashboardData(month, year);
}

function addTransactionWithAuth(sessionToken, data) {
  setUserSession(sessionToken);
  return addTransaction(data);
}

function getTransactionsWithAuth(sessionToken, month, year) {
  setUserSession(sessionToken);
  return getTransactions(month, year);
}

function getTransactionsByDateRangeWithAuth(sessionToken, startDate, endDate) {
  setUserSession(sessionToken);
  return getTransactionsByDateRange(startDate, endDate);
}

function deleteTransactionWithAuth(sessionToken, rowIndex) {
  setUserSession(sessionToken);
  return deleteTransaction(rowIndex);
}

function addIncomeEntryWithAuth(sessionToken, data) {
  setUserSession(sessionToken);
  return addIncomeEntry(data);
}

function getIncomeEntriesWithAuth(sessionToken, month, year) {
  setUserSession(sessionToken);
  return getIncomeEntries(month, year);
}

function deleteIncomeEntryWithAuth(sessionToken, rowIndex) {
  setUserSession(sessionToken);
  return deleteIncomeEntry(rowIndex);
}

function getSettingsWithAuth(sessionToken) {
  setUserSession(sessionToken);
  return getSettings();
}

function saveSettingsWithAuth(sessionToken, data) {
  setUserSession(sessionToken);
  return saveSettings(data);
}

function applyReminderTriggerWithAuth(sessionToken) {
  setUserSession(sessionToken);
  return applyReminderTrigger();
}

function sendDailyReminderWithAuth(sessionToken) {
  setUserSession(sessionToken);
  sendDailyReminder();
  return { success: true, message: 'Test email sent!' };
}

function exportDataAsJSONWithAuth(sessionToken) {
  setUserSession(sessionToken);
  return exportDataAsJSON();
}

function exportTransactionsAsCSVWithAuth(sessionToken) {
  setUserSession(sessionToken);
  return exportTransactionsAsCSV();
}

function importDataFromJSONWithAuth(sessionToken, jsonString) {
  setUserSession(sessionToken);
  return importDataFromJSON(jsonString);
}

// ═══════════════════════════════════════════════════════════════════
//  DASHBOARD AGGREGATION
// ═══════════════════════════════════════════════════════════════════
function getDashboardData(month, year) {
  try {
    const now  = new Date();
    const m    = (month !== undefined) ? month : now.getMonth() + 1;
    const y    = (year  !== undefined) ? year  : now.getFullYear();

    const transactions  = getTransactions(m, y);
    const incomeEntries = getIncomeEntries(m, y);
    const settings      = getSettings();

    const extraIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
    const totalIncome = settings.monthlyIncome + extraIncome;
    const incomeBySource = {};
    incomeEntries.forEach(e => { incomeBySource[e.source] = (incomeBySource[e.source]||0) + e.amount; });

    const totalSpent   = transactions.reduce((s, t) => s + t.amount, 0);
    const totalBudget  = Object.values(settings.budgets).reduce((s, b) => s + b, 0);
    const totalSaved   = totalIncome - totalSpent;
    const remainBudget = totalBudget - totalSpent;
    const savingsRate  = totalIncome > 0 ? (totalSaved / totalIncome) * 100 : 0;

    const spendingByCategory = {};
    settings.categories.forEach(c => { spendingByCategory[c] = 0; });
    transactions.forEach(t => {
      if (t.category in spendingByCategory) spendingByCategory[t.category] += t.amount;
      else spendingByCategory['Others'] = (spendingByCategory['Others']||0) + t.amount;
    });

    const spendingBySubcategory = {};
    settings.categories.forEach(cat => {
      spendingBySubcategory[cat] = {};
      (settings.subcategories[cat]||[]).forEach(sub => { spendingBySubcategory[cat][sub] = 0; });
    });
    transactions.forEach(t => {
      const cat = t.category in spendingBySubcategory ? t.category : 'Others';
      if (!spendingBySubcategory[cat]) spendingBySubcategory[cat] = {};
      const key = (t.subcategory && t.subcategory.trim()) ? t.subcategory.trim() : '(Untagged)';
      spendingBySubcategory[cat][key] = (spendingBySubcategory[cat][key]||0) + t.amount;
    });
    Object.keys(spendingBySubcategory).forEach(cat => {
      Object.keys(spendingBySubcategory[cat]).forEach(sub => {
        if (spendingBySubcategory[cat][sub] === 0) delete spendingBySubcategory[cat][sub];
      });
    });

    const budgetStatus = {};
    settings.categories.forEach(cat => {
      const spent = spendingByCategory[cat]||0, budget = settings.budgets[cat]||0;
      budgetStatus[cat] = { spent, budget, remaining:budget-spent, percentage:budget>0?Math.min((spent/budget)*100,100):0, isOver:spent>budget };
    });

    return {
      success:true, month:m, year:y, monthName:_monthName(m),
      monthlyIncome:settings.monthlyIncome, extraIncome, totalIncome,
      currency:settings.currency, incomeSources:settings.incomeSources,
      incomeEntries, incomeBySource, reminder:settings.reminder,
      categories:settings.categories, budgets:settings.budgets,
      icons:settings.icons, subcategories:settings.subcategories,
      totalSpent, totalBudget, totalSaved, remainingBudget:remainBudget, savingsRate,
      spendingByCategory, spendingBySubcategory, budgetStatus,
      dailySpending:_getDailySpending(transactions,m,y),
      weeklySpending:_getWeeklySpending(transactions),
      recentTransactions:transactions.slice(0,50),
      transactionCount:transactions.length
    };
  } catch (err) {
    Logger.log('[getDashboardData] ERROR: ' + err);
    return { success:false, message:err.message };
  }
}

function _getDailySpending(transactions, month, year) {
  const days = new Date(year, month, 0).getDate(), result = [];
  for (let d = 1; d <= days; d++) {
    const dateStr = year+'-'+String(month).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    result.push({ day:d, date:dateStr, amount:transactions.filter(t=>t.date===dateStr).reduce((s,t)=>s+t.amount,0) });
  }
  return result;
}

function _getWeeklySpending(transactions) {
  const map = {};
  transactions.forEach(t => { const wk='Week '+_isoWeek(new Date(t.date)); map[wk]=(map[wk]||0)+t.amount; });
  return Object.entries(map).map(([week,amount])=>({week,amount})).sort((a,b)=>+a.week.replace('Week ','')-+b.week.replace('Week ',''));
}

function _isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day = d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
  return Math.ceil(((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/86400000+1)/7);
}

function _monthName(m) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m-1]||'';
}

// ═══════════════════════════════════════════════════════════════════
//  ONE-TIME SETUP
// ═══════════════════════════════════════════════════════════════════
function initializeSpreadsheet() {
  const ss = getSpreadsheet();
  initializeSpreadsheetById(ss.getId());
}

function initializeSpreadsheetById(spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);

  const txSheet = ss.getSheetByName(TRANSACTIONS_SHEET)||ss.insertSheet(TRANSACTIONS_SHEET);
  txSheet.clearContents();
  txSheet.getRange(1,1,1,6).setValues([['Date','Amount','Category','Subcategory','Note','Entry Timestamp']]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#f8fafc');
  txSheet.setColumnWidths(1,6,130); txSheet.setColumnWidth(5,220); txSheet.setFrozenRows(1);

  const incSheet = ss.getSheetByName(INCOME_SHEET)||ss.insertSheet(INCOME_SHEET);
  incSheet.clearContents();
  incSheet.getRange(1,1,1,5).setValues([['Date','Amount','Source','Note','Entry Timestamp']]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#f8fafc');
  incSheet.setColumnWidths(1,5,140); incSheet.setColumnWidth(4,220); incSheet.setFrozenRows(1);

  const stSheet = ss.getSheetByName(SETTINGS_SHEET)||ss.insertSheet(SETTINGS_SHEET);
  stSheet.clearContents();
  stSheet.getRange(1,1,1,5).setValues([['Key','Value','Budget','Icon','Subcategories (JSON)']]).setFontWeight('bold').setBackground('#0f172a').setFontColor('#f8fafc');
  const def = _defaultSettings();
  const rows = [
    ['MONTHLY_INCOME',def.monthlyIncome,'','',''],['CURRENCY',def.currency,'','',''],
    ['REMINDER_ENABLED','false','','',''],['REMINDER_EMAIL','','','',''],['REMINDER_HOUR',20,'','','']
  ];
  def.incomeSources.forEach(src=>rows.push(['INCOME_SOURCE',src,'','','']));
  def.categories.forEach(c=>rows.push(['CATEGORY',c,def.budgets[c],def.icons[c]||'📦',JSON.stringify(def.subcategories[c]||[])]));
  stSheet.getRange(2,1,rows.length,5).setValues(rows);
  stSheet.setColumnWidths(1,5,140); stSheet.setColumnWidth(5,260); stSheet.setFrozenRows(1);

  // Delete default Sheet1 if it exists
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  Logger.log('✅ Sheets initialized for spreadsheet: ' + spreadsheetId);
}

// ═══════════════════════════════════════════════════════════════════
//  EXPORT / IMPORT FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Export all data as JSON
 */
function exportDataAsJSON() {
  try {
    const now = new Date();
    const transactions = getAllTransactions();
    const incomeEntries = getAllIncomeEntries();
    const settings = getSettings();

    const exportData = {
      exportDate: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      version: '5.0',
      userEmail: getCurrentUserEmail(),
      transactions: transactions,
      incomeEntries: incomeEntries,
      settings: settings
    };

    return {
      success: true,
      data: JSON.stringify(exportData, null, 2),
      filename: 'fintrack_export_' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '.json'
    };
  } catch (err) {
    Logger.log('[exportDataAsJSON] ERROR: ' + err);
    return { success: false, message: err.message };
  }
}

/**
 * Export transactions as CSV
 */
function exportTransactionsAsCSV() {
  try {
    const transactions = getAllTransactions();
    const now = new Date();

    let csv = 'Date,Amount,Category,Subcategory,Note,Timestamp\n';

    transactions.forEach(tx => {
      csv += '"' + tx.date + '",';
      csv += tx.amount + ',';
      csv += '"' + (tx.category || '').replace(/"/g, '""') + '",';
      csv += '"' + (tx.subcategory || '').replace(/"/g, '""') + '",';
      csv += '"' + (tx.note || '').replace(/"/g, '""') + '",';
      csv += '"' + (tx.timestamp || '') + '"\n';
    });

    return {
      success: true,
      data: csv,
      filename: 'fintrack_transactions_' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '.csv'
    };
  } catch (err) {
    Logger.log('[exportTransactionsAsCSV] ERROR: ' + err);
    return { success: false, message: err.message };
  }
}

/**
 * Import data from JSON
 */
function importDataFromJSON(jsonString) {
  try {
    const importData = JSON.parse(jsonString);

    if (!importData.version) {
      return { success: false, message: 'Invalid import file format.' };
    }

    let importedCount = {
      transactions: 0,
      incomeEntries: 0,
      settingsUpdated: false
    };

    // Import transactions
    if (importData.transactions && Array.isArray(importData.transactions)) {
      const sheet = getOrCreateSheet(TRANSACTIONS_SHEET);
      importData.transactions.forEach(tx => {
        if (tx.date && tx.amount && tx.category) {
          sheet.appendRow([
            new Date(tx.date),
            parseFloat(tx.amount),
            tx.category,
            tx.subcategory || '',
            tx.note || '',
            new Date()
          ]);
          importedCount.transactions++;
        }
      });
    }

    // Import income entries
    if (importData.incomeEntries && Array.isArray(importData.incomeEntries)) {
      const sheet = getOrCreateSheet(INCOME_SHEET);
      importData.incomeEntries.forEach(entry => {
        if (entry.date && entry.amount && entry.source) {
          sheet.appendRow([
            new Date(entry.date),
            parseFloat(entry.amount),
            entry.source,
            entry.note || '',
            new Date()
          ]);
          importedCount.incomeEntries++;
        }
      });
    }

    // Import settings (optional - user can choose to skip)
    if (importData.settings) {
      const result = saveSettings(importData.settings);
      importedCount.settingsUpdated = result.success;
    }

    return {
      success: true,
      message: 'Import completed! ' + importedCount.transactions + ' transactions, ' +
               importedCount.incomeEntries + ' income entries imported.',
      count: importedCount
    };

  } catch (err) {
    Logger.log('[importDataFromJSON] ERROR: ' + err);
    return { success: false, message: 'Import failed: ' + err.message };
  }
}