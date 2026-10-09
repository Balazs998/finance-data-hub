// send_value_emails.groovy
// Finance Data Hub sample: one Budget vs Actual email per cost center owner.
// Groovy job for Jedox Integrator 26.1. Synthetic sample data, example.com addresses only.
//
// The file has two parts:
// PART 1 Plain Groovy, no Jedox API. Builds the subject and HTML of one email.
// You can run and test it anywhere Groovy runs.
// PART 2 The Jedox block at the end. Reads the job variables, the files and the
// cube extract, then sends one email per cost center.
//
// Two rules this file follows on purpose:
// - Only single-quoted strings, and no dollar sign followed by a brace anywhere.
// Integrator replaces its own variables written that way in job scripts, and
// Groovy double-quoted strings expand them as well.
// - The email template uses {{NAME}} markers. They are filled literally, in one
// pass, so a value that contains $ < & or {{ is never expanded again.

import groovy.transform.Field
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols

// ============================== PART 1: pure builder ==============================

// The 12 markers email-template.html must contain.
@Field final List<String> EMAIL_MARKERS = [
    'SUBJECT', 'HEADER_LABEL', 'TITLE', 'PERIOD', 'VERSION', 'GREETING',
    'INTRO', 'HEADER_CELLS', 'TABLE_ROWS', 'TOTAL_CELLS', 'NOTE', 'FOOTER'
]

// Cell snippets, copied from Web Designer's cell-snippets.html.
@Field final String TH_LEFT = '<th align="left" style="padding:8px 10px;border-bottom:2px solid #1F2933;font-size:12px;text-transform:uppercase;color:#52606D;">{{LABEL}}</th>'
@Field final String TH_RIGHT = '<th align="right" style="padding:8px 10px;border-bottom:2px solid #1F2933;font-size:12px;text-transform:uppercase;color:#52606D;">{{LABEL}}</th>'
@Field final String TD_TEXT = '<td align="left" style="padding:8px 10px;border-bottom:1px solid #E4E9EE;">{{VALUE}}</td>'
@Field final String TD_NUMBER = '<td align="right" style="padding:8px 10px;border-bottom:1px solid #E4E9EE;font-family:Consolas,Menlo,monospace;">{{NUMBER}}</td>'
@Field final String TD_NUMBER_UNFAVORABLE = '<td align="right" style="padding:8px 10px;border-bottom:1px solid #E4E9EE;font-family:Consolas,Menlo,monospace;color:#C2410C;">{{NUMBER}}</td>'
@Field final String TD_TOTAL = '<td align="right" style="padding:10px;border-top:2px solid #1F2933;font-weight:bold;font-family:Consolas,Menlo,monospace;">{{NUMBER}}</td>'
// Label cell of the total row, as in Web Designer's email-preview-sample.html.
@Field final String TD_TOTAL_LABEL = '<td align="left" style="padding:10px;border-top:2px solid #1F2933;font-weight:bold;">{{VALUE}}</td>'
// Alternate rows get this background (cell-snippets.html: alternate row background #F7F9FB).
@Field final String ROW_BORDER = 'border-bottom:1px solid #E4E9EE;'
@Field final String ROW_BORDER_SHADED = 'border-bottom:1px solid #E4E9EE;background:#F7F9FB;'
@Field final String UNFAVORABLE_COLOR = 'color:#C2410C;'

// Wording. Plain text: it is HTML-escaped before it goes into the email.
// Markers you can use here: {{COST_CENTER}} {{COST_CENTER_NAME}} {{OWNER_NAME}}
// {{PERIOD}} {{VERSION_PLAN}} {{VERSION_ACTUAL}}
@Field final Map<String, String> TEXT = [
    HEADER_LABEL : 'Monthly cost center report',
    TITLE : 'Cost center {{COST_CENTER}} {{COST_CENTER_NAME}}',
    GREETING : 'Hello {{OWNER_NAME}},',
    INTRO : 'Here are the {{PERIOD}} values for your cost center, {{VERSION_ACTUAL}} against {{VERSION_PLAN}} by account.',
    NOTE : 'Variance is {{VERSION_ACTUAL}} minus {{VERSION_PLAN}}. Highlighted variances are unfavorable for that account type. Sample data only.',
    FOOTER : 'Sent automatically by a Jedox Integrator job.',
    FOOTER_TEST : ' Test mode: on. Intended recipient: {{OWNER_EMAIL}}.',
    COL_ACCOUNT : 'Account',
    COL_VARIANCE : 'Variance',
    TOTAL_NET : 'Net result (revenue minus expense)',
    TOTAL_EXPENSE: 'Total expense',
    TEST_PREFIX : '[TEST for {{OWNER_EMAIL}}] '
]

// Characters replaced before any value goes into the HTML. $ { } are encoded too,
// so data can never look like a template marker or an Integrator variable.
@Field final Map<String, String> HTML_ESCAPES = [
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
    '$': '&#36;', '{': '&#123;', '}': '&#125;'
]

String escapeHtml(Object value) {
    if (value == null) return ''
    String s = value.toString()
    StringBuilder out = new StringBuilder(s.length() + 16)
    for (int i = 0; i < s.length(); i++) {
        String c = s.substring(i, i + 1)
        String rep = HTML_ESCAPES.get(c)
        out.append(rep != null ? rep : c)
    }
    return out.toString()
}

// Replaces every {{NAME}} in one left-to-right pass. Literal: no regex, no GString.
// Inserted values are never scanned again. An unknown or unclosed marker throws.
String fillMarkers(String template, Map<String, String> values) {
    StringBuilder out = new StringBuilder(template.length() + 1024)
    int pos = 0
    while (true) {
        int start = template.indexOf('{{', pos)
        if (start < 0) {
            out.append(template.substring(pos))
            break
        }
        int end = template.indexOf('}}', start + 2)
        if (end < 0) {
            throw new IllegalStateException('Unclosed {{ marker at position ' + start)
        }
        String name = template.substring(start + 2, end)
        if (!values.containsKey(name)) {
            throw new IllegalStateException('No value for marker {{' + name + '}}')
        }
        out.append(template.substring(pos, start))
        Object v = values.get(name)
        out.append(v == null ? '' : v.toString())
        pos = end + 2
    }
    return out.toString()
}

// Fails loudly if a finished email still contains a marker or an Integrator variable.
void assertNoLeftovers(String html, String context) {
    String dollarBrace = '$' + '{'
    if (html.contains('{{') || html.contains('}}') || html.contains(dollarBrace)) {
        throw new IllegalStateException('Leftover {{ or dollar-brace marker in ' + context)
    }
}

// Throws if the template is missing one of the 12 markers.
void checkTemplate(String template) {
    List<String> missing = EMAIL_MARKERS.findAll { String m -> !template.contains('{{' + m + '}}') }
    if (!missing.isEmpty()) {
        throw new IllegalStateException('Email template is missing markers: ' + missing.join(', '))
    }
}

BigDecimal toAmount(Object value) {
    if (value == null) return BigDecimal.ZERO
    String s = value.toString().trim()
    if (s.isEmpty()) return BigDecimal.ZERO
    return new BigDecimal(s)
}

String formatAmount(BigDecimal value) {
    BigDecimal v = value.setScale(2, RoundingMode.HALF_UP)
    if (v.signum() == 0) v = BigDecimal.ZERO.setScale(2)
    DecimalFormat f = new DecimalFormat('#,##0.00', DecimalFormatSymbols.getInstance(Locale.US))
    return f.format(v)
}

// Same rule as the plan vs. actuals post: amounts are stored positive,
// so more revenue is good and more expense is bad.
String varianceFlag(String accountType, BigDecimal variance) {
    BigDecimal v = variance.setScale(2, RoundingMode.HALF_UP)
    if (v.signum() == 0) return 'ON_PLAN'
    if (accountType == 'REVENUE') return v.signum() > 0 ? 'FAVORABLE' : 'UNFAVORABLE'
    if (accountType == 'EXPENSE') return v.signum() < 0 ? 'FAVORABLE' : 'UNFAVORABLE'
    return 'UNKNOWN'
}

// Small CSV reader: header row, commas, double-quoted fields with "" inside.
List<Map<String, String>> parseCsv(String text) {
    if (text.startsWith('\uFEFF')) text = text.substring(1)
    List<List<String>> records = []
    List<String> fields = []
    StringBuilder cur = new StringBuilder()
    boolean inQuotes = false
    int i = 0
    while (i < text.length()) {
        char c = text.charAt(i)
        if (inQuotes) {
            if (c == (char) '"') {
                if (i + 1 < text.length() && text.charAt(i + 1) == (char) '"') { cur.append('"'); i++ }
                else inQuotes = false
            } else cur.append(c)
        } else if (c == (char) '"') {
            inQuotes = true
        } else if (c == (char) ',') {
            fields.add(cur.toString()); cur = new StringBuilder()
        } else if (c == (char) '\n' || c == (char) '\r') {
            if (c == (char) '\r' && i + 1 < text.length() && text.charAt(i + 1) == (char) '\n') i++
            fields.add(cur.toString()); cur = new StringBuilder()
            if (!(fields.size() == 1 && fields[0].isEmpty())) records.add(fields)
            fields = []
        } else cur.append(c)
        i++
    }
    if (cur.length() > 0 || !fields.isEmpty()) {
        fields.add(cur.toString())
        records.add(fields)
    }
    if (records.isEmpty()) return []
    List<String> header = records[0].collect { String h -> h.trim() }
    List<Map<String, String>> result = []
    for (int r = 1; r < records.size(); r++) {
        Map<String, String> row = [:]
        for (int k = 0; k < header.size(); k++) {
            row.put(header[k], k < records[r].size() ? records[r][k].trim() : '')
        }
        result.add(row)
    }
    return result
}

// Turns extract rows [costCenter, account, version, value] into
// costCenter -> account -> [plan: x, actual: y]. Other versions are ignored.
Map<String, Map<String, Map<String, BigDecimal>>> groupAmounts(List<Map> rows, String versionPlan, String versionActual) {
    Map<String, Map<String, Map<String, BigDecimal>>> result = new TreeMap<>()
    for (Map row : rows) {
        String version = row.version?.toString()
        String key = version == versionPlan ? 'plan' : (version == versionActual ? 'actual' : null)
        if (key == null) continue
        String cc = row.costCenter.toString()
        String acc = row.account.toString()
        Map<String, Map<String, BigDecimal>> byAccount = result.computeIfAbsent(cc, { k -> new TreeMap<>() })
        Map<String, BigDecimal> cell = byAccount.computeIfAbsent(acc, { k -> [plan: BigDecimal.ZERO, actual: BigDecimal.ZERO] })
        cell.put(key, cell.get(key) + toAmount(row.value))
    }
    return result
}

String shade(String snippet, boolean shaded) {
    return shaded ? snippet.replace(ROW_BORDER, ROW_BORDER_SHADED) : snippet
}

String numberCell(String snippet, BigDecimal value) {
    return fillMarkers(snippet, [NUMBER: escapeHtml(formatAmount(value))])
}

// Builds one email. Returns [subject: plain text, html: finished HTML].
// args: template, subjectTemplate, costCenter, costCenterName, ownerName, ownerEmail,
// period, versionPlan, versionActual, amounts (account -> [plan, actual]),
// accounts (account -> [name, type]), colorVariance, testMode
Map<String, String> buildEmail(Map args) {
    String template = args.template
    checkTemplate(template)
    boolean color = args.colorVariance as boolean
    Map<String, Map<String, BigDecimal>> amounts = args.amounts
    Map<String, Map<String, String>> accounts = args.accounts

    // Plain-text values for the wording markers.
    Map<String, String> words = [
        COST_CENTER : args.costCenter ?: '',
        COST_CENTER_NAME: args.costCenterName ?: '',
        OWNER_NAME : args.ownerName ?: '',
        OWNER_EMAIL : args.ownerEmail ?: '',
        PERIOD : args.period ?: '',
        VERSION_PLAN : args.versionPlan ?: '',
        VERSION_ACTUAL : args.versionActual ?: ''
    ]
    Closure<String> say = { String key -> escapeHtml(fillMarkers(TEXT.get(key), words).trim()) }

    // Header row.
    String headerCells = fillMarkers(TH_LEFT, [LABEL: escapeHtml(TEXT.COL_ACCOUNT)]) +
        fillMarkers(TH_RIGHT, [LABEL: escapeHtml(args.versionPlan)]) +
        fillMarkers(TH_RIGHT, [LABEL: escapeHtml(args.versionActual)]) +
        fillMarkers(TH_RIGHT, [LABEL: escapeHtml(TEXT.COL_VARIANCE)])

    // Body rows, one per account, sorted by account code.
    StringBuilder rows = new StringBuilder()
    BigDecimal revPlan = 0, revActual = 0, expPlan = 0, expActual = 0
    boolean hasRevenue = false
    int n = 0
    for (String account : new TreeSet<String>(amounts.keySet())) {
        Map<String, String> meta = accounts.get(account)
        if (meta == null) {
            throw new IllegalStateException('Account ' + account + ' is not in the accounts file')
        }
        String type = meta.type
        BigDecimal plan = amounts[account].plan
        BigDecimal actual = amounts[account].actual
        if (plan.signum() == 0 && actual.signum() == 0) continue
        BigDecimal variance = actual - plan
        boolean unfavorable = color && varianceFlag(type, variance) == 'UNFAVORABLE'
        boolean shaded = (n % 2) == 1
        rows.append('<tr>')
        rows.append(fillMarkers(shade(TD_TEXT, shaded), [VALUE: escapeHtml(meta.name ?: account)]))
        rows.append(numberCell(shade(TD_NUMBER, shaded), plan))
        rows.append(numberCell(shade(TD_NUMBER, shaded), actual))
        rows.append(numberCell(shade(unfavorable ? TD_NUMBER_UNFAVORABLE : TD_NUMBER, shaded), variance))
        rows.append('</tr>\n')
        n++
        if (type == 'REVENUE') { hasRevenue = true; revPlan += plan; revActual += actual }
        else if (type == 'EXPENSE') { expPlan += plan; expActual += actual }
        else throw new IllegalStateException('Account ' + account + ' has unknown type ' + type)
    }
    if (n == 0) throw new IllegalStateException('No values for cost center ' + args.costCenter)

    // Total row. Revenue and expense are both stored positive, so adding them up
    // would mean nothing: with revenue it's a net result, otherwise total expense.
    BigDecimal totPlan = hasRevenue ? revPlan - expPlan : expPlan
    BigDecimal totActual = hasRevenue ? revActual - expActual : expActual
    BigDecimal totVariance = totActual - totPlan
    String totType = hasRevenue ? 'REVENUE' : 'EXPENSE'
    String totVarSnippet = (color && varianceFlag(totType, totVariance) == 'UNFAVORABLE') ?
        TD_TOTAL.replace('font-weight:bold;', 'font-weight:bold;' + UNFAVORABLE_COLOR) : TD_TOTAL
    String totalCells = fillMarkers(TD_TOTAL_LABEL, [VALUE: say(hasRevenue ? 'TOTAL_NET' : 'TOTAL_EXPENSE')]) +
        numberCell(TD_TOTAL, totPlan) + numberCell(TD_TOTAL, totActual) + numberCell(totVarSnippet, totVariance)

    // Subject: plain text, no line breaks.
    String subject = fillMarkers(args.subjectTemplate, words)
    if (args.testMode) subject = fillMarkers(TEXT.TEST_PREFIX, words) + subject
    subject = subject.replaceAll('[\\r\\n]+', ' ').trim()

    String footer = fillMarkers(TEXT.FOOTER, words) + (args.testMode ? fillMarkers(TEXT.FOOTER_TEST, words) : '')

    Map<String, String> values = [
        SUBJECT : escapeHtml(subject),
        HEADER_LABEL: say('HEADER_LABEL'),
        TITLE : say('TITLE'),
        PERIOD : escapeHtml(args.period),
        VERSION : escapeHtml(args.versionActual + ' vs ' + args.versionPlan),
        GREETING : say('GREETING'),
        INTRO : say('INTRO'),
        HEADER_CELLS: headerCells,
        TABLE_ROWS : rows.toString(),
        TOTAL_CELLS : totalCells,
        NOTE : say('NOTE'),
        FOOTER : escapeHtml(footer)
    ]
    String html = fillMarkers(template, values)
    assertNoLeftovers(html, 'email for ' + args.costCenter)
    return [subject: subject, html: html]
}

// ============================== PART 2: Jedox block ===============================
// Everything above runs without Jedox. Everything below needs the job's bindings:
// API (JobAPI), FILE (FileAPI) and LOG.

if (!binding.hasVariable('API')) {
    println 'No Jedox API found: PART 1 loaded, nothing sent.'
    return
}

Closure<String> setting = { String name, String fallback ->
    Object v = API.getProperty(name)
    (v == null || v.toString().trim().isEmpty()) ? fallback : v.toString().trim()
}
Closure<String> readFile = { String connectionName ->
    InputStream is = FILE.readBinary(connectionName)
    try { return is.getText('UTF-8') } finally { is.close() }
}

// Anything other than 'false' keeps test mode on.
boolean testMode = !setting('TEST_MODE', 'true').equalsIgnoreCase('false')
String testTo = setting('RECIPIENT_TEST', 'test.recipient@example.com')
String period = setting('PERIOD', '2026-03')
String vPlan = setting('VERSION_PLAN', 'Budget')
String vActual = setting('VERSION_ACTUAL', 'Actual')
String subjectTpl = setting('SUBJECT_TEMPLATE', '{{COST_CENTER}} {{VERSION_ACTUAL}} vs {{VERSION_PLAN}}, {{PERIOD}}')
boolean colorVar = !setting('COLOR_VARIANCE', 'true').equalsIgnoreCase('false')
String extractName = setting('SOURCE_EXTRACT', 'PnL_BudgetActual')

// File connections (location FileSystem, relative to the local files folder).
// Their file names are the job variables TEMPLATE_FILE, RECIPIENTS_FILE,
// ACCOUNTS_FILE and COST_CENTERS_FILE.
String template = readFile('EmailTemplate')
List<Map<String, String>> recipients = parseCsv(readFile('EmailRecipients'))
Map<String, Map<String, String>> accounts = [:]
parseCsv(readFile('Accounts')).each { r -> accounts[r.account] = [name: r.account_name, type: r.account_type] }
Map<String, String> ccNames = [:]
parseCsv(readFile('CostCenters')).each { r -> ccNames[r.cost_center] = r.cost_center_name }

// Read the Cube Slice extract.
// Column names assume one column per dimension, named
// like the dimension, plus the value column. Check them in the extract's preview.
List<Map> rows = []
def src = API.initSource(extractName)
if (src == null) throw new IllegalStateException('Could not initialize extract ' + extractName)
while (src.nextRow()) {
    rows.add([costCenter: src.getColumnString('CostCenter'),
              account : src.getColumnString('Account'),
              version : src.getColumnString('Version'),
              value : src.getColumnValue('#Value')])
}
src.close()

Map<String, Map<String, Map<String, BigDecimal>>> amounts = groupAmounts(rows, vPlan, vActual)
(amounts.keySet() - recipients.collect { it.cost_center }).each { cc ->
    LOG.warn('No recipient for cost center ' + cc + ', skipped')
}

def mailer = API.getMailer()
int sent = 0
for (Map<String, String> r : recipients) {
    String cc = r.cost_center
    if (!amounts.containsKey(cc)) {
        LOG.warn('No values for ' + cc + ' in ' + period + ', no email')
        continue
    }
    Map<String, String> email = buildEmail(
        template: template, subjectTemplate: subjectTpl,
        costCenter: cc, costCenterName: ccNames[cc], ownerName: r.owner_name, ownerEmail: r.owner_email,
        period: period, versionPlan: vPlan, versionActual: vActual,
        amounts: amounts[cc], accounts: accounts, colorVariance: colorVar, testMode: testMode)
    String to = testMode ? testTo : r.owner_email
    mailer.reset()
    mailer.addRecipient(to)
    mailer.setSubject(email.subject)
    mailer.setHtmlMessage(email.html)
    mailer.send()
    sent++
    LOG.info('Email ' + sent + ': ' + cc + ' to ' + to + (testMode ? ' (test mode, intended ' + r.owner_email + ')' : '') + ', subject: ' + email.subject)
}
LOG.info('Done: ' + sent + ' emails, test mode ' + (testMode ? 'on' : 'off'))
