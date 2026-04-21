# FinTrack - Personal Finance Tracker

A comprehensive personal finance tracking web application built with Google Apps Script. FinTrack helps you manage your expenses, track income, set budgets, and visualize your spending patterns with an intuitive dashboard.

## Features

### Core Functionality
- **Multi-User Authentication**: Secure user registration and login with password hashing
- **Expense Tracking**: Record daily expenses with categories, subcategories, and notes
- **Income Management**: Track monthly salary and additional income sources
- **Budget Management**: Set and monitor budgets for different spending categories
- **Dashboard Analytics**: Visualize spending patterns with interactive charts
- **Daily Email Reminders**: Automated daily spending reminders via email
- **Data Export/Import**: Export data as JSON or CSV, and import from JSON
- **Mobile Responsive**: Fully responsive design for mobile and desktop

### User Interface
- Clean, modern design with Tailwind CSS
- Interactive charts using Chart.js (Pie, Bar, Subcategory breakdown)
- Real-time budget tracking with progress indicators
- Collapsible sidebar navigation
- Month-by-month data filtering
- Toast notifications for user feedback

### Security
- SHA-256 password hashing
- HMAC-based session tokens with 8-hour expiration
- Secure user data isolation (each user has their own spreadsheet)
- Brute-force protection with deliberate delays

## Technology Stack

- **Backend**: Google Apps Script (JavaScript)
- **Frontend**: HTML5, CSS3, JavaScript
- **Styling**: Tailwind CSS
- **Charts**: Chart.js v4.4.0
- **Fonts**: Google Fonts (Syne, Manrope, JetBrains Mono)
- **Database**: Google Sheets (per-user spreadsheets)
- **Storage**: Google Drive + PropertiesService

## Project Structure

```
Spending-Tracker/
├── Code.gs              # Backend logic (Google Apps Script)
│   ├── User management & authentication
│   ├── Transaction CRUD operations
│   ├── Income tracking
│   ├── Settings & budget management
│   ├── Dashboard data aggregation
│   ├── Email reminder system
│   └── Export/Import functionality
│
├── Index.html           # Frontend UI (single-page app)
│   ├── Login/Register screens
│   ├── Dashboard view
│   ├── Income management view
│   ├── Add expense view
│   ├── Transaction history view
│   └── Settings view
│
├── appsscript.json      # Apps Script manifest
│   ├── OAuth scopes
│   ├── Web app settings
│   └── Runtime configuration
│
└── README.md            # This file
```

## Deployment

### Prerequisites

1. A Google account
2. Access to Google Apps Script
3. Basic understanding of Google Apps Script and Google Sheets

### Step 1: Create a New Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/)
2. Click **+ New project**
3. Name your project (e.g., "FinTrack")

### Step 2: Add Project Files

1. **Delete default Code.gs** if it has any content
2. **Add Code.gs**:
   - Copy the entire content from `Code.gs`
   - Paste it into the default `Code.gs` file

3. **Add Index.html**:
   - Click the **+** button next to Files
   - Select **HTML**
   - Name it `Index`
   - Copy the entire content from `Index.html`
   - Paste it into the new file

4. **Configure appsscript.json**:
   - Click on **Project Settings** (gear icon)
   - Check **Show "appsscript.json" manifest file in editor**
   - Return to the **Editor**
   - Click on `appsscript.json`
   - Replace the content with the content from `appsscript.json`

### Step 3: Configure OAuth Scopes

The `appsscript.json` file already includes all required OAuth scopes:
- `https://www.googleapis.com/auth/spreadsheets` - For storing user data
- `https://www.googleapis.com/auth/gmail.send` - For email reminders
- `https://www.googleapis.com/auth/drive` - For creating/managing spreadsheets
- `https://www.googleapis.com/auth/script.scriptapp` - For trigger management
- `https://www.googleapis.com/auth/userinfo.email` - For user identification

### Step 4: Authorize Reminder Feature (One-Time Setup)

**Important**: This step is required to enable the daily email reminder feature.

1. In the Apps Script editor, select `authorizeReminder` from the function dropdown
2. Click **Run** (▶ button)
3. Review and accept the permissions when prompted
4. Click **Advanced** → **Go to [Project Name] (unsafe)**
5. Click **Allow**
6. You should see a success alert confirming authorization

This grants the `script.scriptapp` permission required for creating time-based triggers.

### Step 5: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click **Select type** → **Web app**
3. Configure the deployment:
   - **Description**: "FinTrack v1.0" (or your version)
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone** (for public access) or **Anyone with Google account**
4. Click **Deploy**
5. **Authorize access**: Click **Authorize access** and complete the OAuth flow
6. Copy the **Web app URL** - this is your app's public URL

### Step 6: Test the Deployment

1. Open the Web app URL in a new browser window
2. You should see the FinTrack login/register screen
3. Create a test account to verify everything works

### Updating the Deployment

When you make changes to the code:

1. Click **Deploy** → **Manage deployments**
2. Click the **Edit** icon (pencil) on your active deployment
3. Change **Version** to **New version**
4. Add a description of changes
5. Click **Deploy**
6. Refresh your web app to see the changes

## Configuration

### Default Settings

The app comes with pre-configured default settings (defined in `Code.gs` line 857):

- **Monthly Income**: MYR 5000
- **Currency**: MYR (Malaysian Ringgit)
- **Default Categories**:
  - Food & Dining (Budget: 800)
  - Transport (Budget: 400)
  - Utilities (Budget: 300)
  - Entertainment (Budget: 200)
  - Shopping (Budget: 300)
  - Health (Budget: 150)
  - Education (Budget: 100)
  - Loan (Budget: 1200)
  - Others (Budget: 150)

- **Default Income Sources**: Allowance, Bonus, Claim, Commission, Freelance, Other

### Customization

Users can customize settings through the Settings page:
- Monthly income amount
- Currency symbol
- Income sources
- Categories (add, edit, delete)
- Budget amounts per category
- Category icons (emoji)
- Subcategories for each category
- Email reminder settings (enable/disable, email address, time)

### Timezone Configuration

The default timezone is set to **Asia/Singapore** in `appsscript.json` (line 2). To change it:

1. Edit `appsscript.json`
2. Change `"timeZone": "Asia/Singapore"` to your timezone
3. Use [IANA timezone format](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
4. Redeploy the app

## Testing

### Manual Testing Checklist

#### 1. Authentication Tests

**Registration**:
- [ ] Register with valid email and password (6+ characters)
- [ ] Try registering with the same email (should fail)
- [ ] Try registering with password < 6 characters (should fail)
- [ ] Verify user spreadsheet is created in Drive under "FinTrack Users" folder

**Login**:
- [ ] Login with correct credentials
- [ ] Try login with wrong password (should fail)
- [ ] Try login with non-existent email (should fail)
- [ ] Verify session persists on page reload
- [ ] Verify session expires after 8 hours

**Logout**:
- [ ] Logout successfully
- [ ] Verify redirected to login screen
- [ ] Verify cannot access app without re-login

#### 2. Expense Tracking Tests

**Add Transaction**:
- [ ] Add expense with date, amount, category
- [ ] Add expense with subcategory
- [ ] Add expense with note
- [ ] Verify transaction appears in History view
- [ ] Verify transaction appears in user's Google Sheet
- [ ] Try adding expense with missing required fields (should fail)
- [ ] Try adding expense with invalid amount (should fail)

**View Transactions**:
- [ ] View transactions for current month
- [ ] Navigate to previous/next month
- [ ] Verify transactions are filtered by month correctly
- [ ] Verify transactions are sorted by date (newest first)

**Delete Transaction**:
- [ ] Delete a transaction
- [ ] Verify transaction removed from list
- [ ] Verify transaction removed from Google Sheet
- [ ] Verify dashboard updates accordingly

#### 3. Income Tracking Tests

**Add Income Entry**:
- [ ] Add income with date, amount, source
- [ ] Add income with note
- [ ] Verify income appears in Income view
- [ ] Verify income updates dashboard totals
- [ ] Try adding income with missing fields (should fail)

**View Income**:
- [ ] View income entries for current month
- [ ] Navigate to different months
- [ ] Verify income summary bar shows correct totals

**Delete Income**:
- [ ] Delete an income entry
- [ ] Verify removal from list and sheet

#### 4. Dashboard Tests

**KPI Cards**:
- [ ] Verify "Total Spent" shows correct sum
- [ ] Verify "Remaining Budget" calculates correctly
- [ ] Verify "Total Saved" = Total Income - Total Spent
- [ ] Verify "Savings Rate" percentage is accurate

**Charts**:
- [ ] Verify Pie Chart shows spending by category
- [ ] Verify Bar Chart shows daily spending trend
- [ ] Verify Subcategory Breakdown chart works
- [ ] Switch between categories in subcategory view
- [ ] Verify Budget Status bars show correct progress
- [ ] Verify charts update when month changes

#### 5. Settings Tests

**Basic Settings**:
- [ ] Update monthly income
- [ ] Change currency
- [ ] Verify changes persist after page reload

**Categories**:
- [ ] Add a new category with budget and icon
- [ ] Edit existing category (name, budget, icon)
- [ ] Delete a category
- [ ] Verify category changes reflect in add expense form

**Subcategories**:
- [ ] Add subcategories to a category
- [ ] Remove subcategories
- [ ] Verify subcategories appear in add expense form

**Income Sources**:
- [ ] Add new income source
- [ ] Remove income source
- [ ] Verify income sources appear in add income form

**Email Reminders**:
- [ ] Enable email reminder
- [ ] Set reminder email address
- [ ] Set reminder time (hour)
- [ ] Click "Send Test Email" - verify email received
- [ ] Save settings - verify trigger created
- [ ] Disable reminder - verify trigger removed
- [ ] Verify daily email is received at scheduled time

#### 6. Export/Import Tests

**Export**:
- [ ] Export data as JSON
- [ ] Verify JSON file downloads correctly
- [ ] Verify JSON contains all transactions, income, and settings
- [ ] Export transactions as CSV
- [ ] Verify CSV file downloads correctly
- [ ] Open CSV in spreadsheet software - verify data integrity

**Import**:
- [ ] Import data from JSON file
- [ ] Verify transactions imported correctly
- [ ] Verify income entries imported correctly
- [ ] Verify settings imported correctly
- [ ] Try importing invalid JSON (should fail gracefully)

#### 7. User Account Tests

**Update Email**:
- [ ] Update account email
- [ ] Verify new session token generated
- [ ] Verify can login with new email
- [ ] Verify old email no longer works

**Update Password**:
- [ ] Update password with correct current password
- [ ] Try updating with wrong current password (should fail)
- [ ] Try updating with password < 6 characters (should fail)
- [ ] Logout and login with new password

#### 8. Multi-User Tests

**User Isolation**:
- [ ] Create multiple user accounts
- [ ] Add transactions in User A account
- [ ] Login as User B
- [ ] Verify User B cannot see User A's data
- [ ] Verify each user has their own spreadsheet

#### 9. UI/UX Tests

**Responsive Design**:
- [ ] Test on desktop (1920x1080, 1366x768)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667, 414x896)
- [ ] Verify sidebar collapses on mobile
- [ ] Verify mobile menu button appears
- [ ] Verify charts are responsive

**Navigation**:
- [ ] Navigate between all tabs
- [ ] Verify correct tab highlighted in sidebar
- [ ] Collapse/expand sidebar
- [ ] Test month navigation (previous/next)

**Form Validation**:
- [ ] Test all form inputs for validation
- [ ] Verify error messages display correctly
- [ ] Verify success messages display correctly

#### 10. Edge Cases & Error Handling

**Data Validation**:
- [ ] Try entering negative amounts (should fail or be handled)
- [ ] Try entering very large amounts (billions)
- [ ] Try entering special characters in text fields
- [ ] Try entering very long text in notes (test truncation)

**Date Handling**:
- [ ] Add transactions in different months
- [ ] Add transactions in different years
- [ ] Verify month navigation works across years

**Empty States**:
- [ ] View dashboard with no transactions
- [ ] View history with no transactions
- [ ] View income with no entries
- [ ] Verify appropriate empty state messages

**Session Management**:
- [ ] Open app in multiple tabs (same user)
- [ ] Verify data syncs across tabs
- [ ] Wait for session to expire (8 hours)
- [ ] Verify forced to re-login

### Automated Testing

Currently, this project relies on manual testing. For automated testing, consider:

1. **Apps Script Testing**:
   - Use Google Apps Script's built-in testing features
   - Write test functions for backend logic
   - Test functions individually from the editor

2. **Frontend Testing**:
   - Use browser automation tools (Selenium, Puppeteer)
   - Test user flows programmatically
   - Set up CI/CD pipeline

3. **API Testing**:
   - Use `google.script.run` calls with callbacks
   - Test error handling and edge cases

### Performance Testing

- [ ] Test with 100+ transactions
- [ ] Test with 1000+ transactions
- [ ] Measure dashboard load time
- [ ] Test chart rendering performance
- [ ] Test with multiple concurrent users

## Usage

### First Time Setup

1. **Register an Account**:
   - Open the web app URL
   - Click the "Register" tab
   - Enter your email and password (min 6 characters)
   - Click "Create Account"

2. **Login**:
   - Enter your registered email and password
   - Click "Login"

3. **Configure Settings** (Recommended):
   - Click "Settings" in the sidebar
   - Set your monthly income
   - Adjust currency if needed
   - Customize categories and budgets to match your needs
   - Add/remove income sources
   - (Optional) Enable email reminders

### Daily Use

1. **Add Expenses**:
   - Click "Add Expense" in sidebar
   - Select date (defaults to today)
   - Enter amount
   - Select category and optionally subcategory
   - Add notes (optional)
   - Click "Save Expense"

2. **Track Income**:
   - Click "Income" in sidebar
   - Click "Add Income" form
   - Enter date, amount, and source
   - Add notes (optional)
   - Click "Save Income"

3. **View Dashboard**:
   - Click "Dashboard" in sidebar
   - View KPI cards (Total Spent, Remaining, Saved, Savings Rate)
   - Analyze spending by category (Pie Chart)
   - Review daily spending trends (Bar Chart)
   - Drill down into subcategories
   - Check budget status for each category

4. **Review History**:
   - Click "History" in sidebar
   - Browse all transactions for the current month
   - Use month navigation to view different months
   - Delete transactions if needed

5. **Export Data**:
   - Go to Settings
   - Scroll to "Export Data" section
   - Click "Export as JSON" for full backup
   - Click "Export as CSV" for transaction data only

### Tips

- Set realistic budgets based on your actual spending patterns
- Review your dashboard weekly to stay on track
- Use subcategories to identify specific spending habits
- Enable daily email reminders to maintain tracking discipline
- Export your data monthly as a backup
- Use the notes field to remember what each expense was for

## Troubleshooting

### Common Issues

**1. "Session expired. Please login again."**
- **Cause**: Session tokens expire after 8 hours
- **Solution**: Login again. Consider staying logged in on trusted devices

**2. "Email reminder not working"**
- **Cause**: `script.scriptapp` scope not authorized
- **Solution**:
  1. Open Apps Script editor
  2. Run `authorizeReminder` function manually
  3. Accept all permissions
  4. Go back to app and re-enable reminder in Settings

**3. "Your data spreadsheet was not found"**
- **Cause**: User's Google Sheet was deleted or moved
- **Solution**: Contact admin or create new account (data lost)

**4. Charts not displaying**
- **Cause**: No data for selected month, or Chart.js failed to load
- **Solution**:
  - Add some transactions
  - Check internet connection
  - Clear browser cache and reload

**5. "Invalid email or password" on login**
- **Cause**: Incorrect credentials or account doesn't exist
- **Solution**: Double-check email/password, or register new account

**6. Import fails**
- **Cause**: Invalid JSON format or corrupted file
- **Solution**: Verify JSON file is valid (use JSON validator)

**7. Cannot delete transaction/income**
- **Cause**: Permission issue or data mismatch
- **Solution**: Refresh page and try again

**8. Budget not updating**
- **Cause**: Category mismatch or data not saved
- **Solution**:
  - Verify transaction saved successfully
  - Check category spelling matches settings
  - Refresh dashboard

### Debugging

**Enable Apps Script Logging**:
1. In Apps Script editor, click **Executions** to view logs
2. Check for error messages and stack traces
3. Use `Logger.log()` statements for debugging

**Browser Console**:
1. Press F12 to open Developer Tools
2. Check Console tab for JavaScript errors
3. Check Network tab for failed API calls

**Check User's Spreadsheet**:
1. Go to Google Drive
2. Find "FinTrack Users" folder
3. Open the user's spreadsheet
4. Verify data is being written correctly

## Security Considerations

### Current Security Measures

1. **Password Hashing**: All passwords are hashed using SHA-256 before storage
2. **Session Tokens**: HMAC-based tokens with 8-hour expiration
3. **User Isolation**: Each user has a separate Google Sheet, data is never shared
4. **Brute Force Protection**: Deliberate 600ms delay on failed login attempts
5. **Input Validation**: All user inputs are validated on both client and server

### Recommendations

1. **Use HTTPS**: Google Apps Script web apps use HTTPS by default
2. **Limit Access**: Set "Who has access" to "Anyone with Google account" instead of "Anyone" for better security
3. **Regular Backups**: Export data regularly
4. **Monitor Logs**: Check Apps Script execution logs for suspicious activity
5. **Update Regularly**: Keep the app updated with latest security patches

### Privacy

- User credentials are stored in PropertiesService (Google's secure key-value store)
- Financial data is stored in Google Sheets under the deployer's Google account
- Email addresses are used only for authentication and reminders
- No data is shared with third parties

## Limitations

1. **Performance**: Google Sheets has performance limits (best with <10,000 transactions per user)
2. **Concurrent Users**: Apps Script has quotas (typically 30 concurrent users max)
3. **Storage**: Limited by Google Drive storage quota
4. **Execution Time**: Apps Script functions timeout after 6 minutes (30 seconds for custom functions)
5. **Trigger Limits**: Maximum 20 time-based triggers per script
6. **Email Quota**: Gmail send limits apply (100 emails/day for free accounts)

## Future Enhancements

Potential features to add:
- [ ] Multi-currency support with exchange rates
- [ ] Recurring transactions/subscriptions
- [ ] Bank account integration
- [ ] Receipt image upload
- [ ] Advanced reports (yearly, quarterly trends)
- [ ] Goal tracking and savings challenges
- [ ] Bill reminders
- [ ] Shared budgets for families/teams
- [ ] Mobile app (React Native/Flutter)
- [ ] Two-factor authentication (2FA)
- [ ] Dark mode
- [ ] Multiple language support
- [ ] PDF export of reports
- [ ] Budget recommendations based on spending patterns

## Contributing

This is a personal project template. To customize for your own use:

1. Fork/clone this project
2. Modify categories, budgets, and defaults in `Code.gs` (_defaultSettings function)
3. Customize UI colors and branding in `Index.html` (CSS variables in `:root`)
4. Add new features as needed
5. Deploy under your own Google Apps Script account

## License

This project is provided as-is for personal and educational use. Feel free to modify and distribute as needed.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Google Apps Script [documentation](https://developers.google.com/apps-script)
3. Check [Apps Script quotas and limitations](https://developers.google.com/apps-script/guides/services/quotas)

## Credits

- Built with [Google Apps Script](https://developers.google.com/apps-script)
- UI styled with [Tailwind CSS](https://tailwindcss.com/)
- Charts powered by [Chart.js](https://www.chartjs.org/)
- Fonts from [Google Fonts](https://fonts.google.com/)

---

**Version**: 5.0
**Last Updated**: 2024
**Developed by**: Appscriot
