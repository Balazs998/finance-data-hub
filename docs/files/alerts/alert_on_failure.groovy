// alert_on_failure.groovy
// Finance Data Hub sample: email only when a nightly load needs attention.
// Groovy job for Jedox Integrator 26.1. Synthetic sample data, example.com addresses only.
//
// PART 1 is plain Groovy: it decides which runs need an alert and builds the text.
// PART 2 is the Jedox block: it reads job variables and the run log, then sends.
// Same rules as send_value_emails.groovy: single-quoted strings only, and no
// dollar sign followed by a brace anywhere in this file.

// ============================== PART 1: pure logic ==============================

// A run needs an alert if it failed, warned, or "succeeded" with 0 rows.
String alertReason(Map<String, String> run) {
    String status = run.status.toLowerCase()
    if (status == 'error') {
        return 'FAILED'
    }
    if (status == 'warning') {
        return 'WARNING'
    }
    if (status == 'success' && run.rows.toInteger() == 0) {
        return 'ZERO ROWS'
    }
    return null
}

List<Map<String, String>> readRuns(String csvText) {
    List<String> lines = csvText.readLines().findAll { it.trim() }
    List<String> header = lines[0].split(',') as List
    return lines.drop(1).collect { String line ->
        List<String> cells = line.split(',', -1) as List
        Map<String, String> row = [:]
        header.eachWithIndex { String name, int i -> row[name] = cells[i] }
        row
    }
}

String buildBody(List<Map<String, String>> flagged, String runDate) {
    StringBuilder sb = new StringBuilder()
    sb.append('Nightly loads on ' + runDate + ' need attention:\n\n')
    flagged.each { Map<String, String> r ->
        sb.append('- ' + r.job + ' (' + r.run_id + '): ' + r.reason + '. ' + r.message + '. Rows: ' + r.rows + '.\n')
    }
    sb.append('\nAll other loads finished normally. No email is sent on quiet nights.\n')
    sb.append('Times are server time.\n')
    return sb.toString()
}

// ============================== PART 2: Jedox block ==============================
// Runs only inside Integrator, where API, FILE and LOG are bound.
// Outside Jedox this block is skipped, so the test script can load this file.

if (binding.hasVariable('API')) {
    String runDate = API.getProperty('RUN_DATE')
    boolean testMode = API.getProperty('TEST_MODE') != 'false'
    String to = testMode ? API.getProperty('RECIPIENT_TEST') : API.getProperty('RECIPIENT_ALERT')

    // Run log via the File connection RunLog (file name = job variable RUN_LOG_FILE).
    // FileAPI, bound as FILE.
    String csvText = FILE.readBinary('RunLog').getText('UTF-8')
    List<Map<String, String>> runs = readRuns(csvText).findAll { it.start.startsWith(runDate) }

    List<Map<String, String>> flagged = []
    runs.each { Map<String, String> r ->
        String reason = alertReason(r)
        if (reason != null) {
            Map<String, String> copy = new LinkedHashMap<String, String>(r)
            copy.reason = reason
            flagged << copy
        }
    }

    if (flagged.isEmpty()) {
        LOG.info('No failed, warning or zero-row runs on ' + runDate + '. No email sent.')
        return
    }

    // JobAPI.getMailer(), not the deprecated ExecutionAPI.getMailer().
    // SMTP server and From address are set centrally (Cloud Console on Jedox Cloud,
    // Web Administration > Settings on-prem), not in this script.
    def mailer = API.getMailer()
    mailer.addRecipient(to)
    mailer.setSubject((testMode ? '[TEST] ' : '') + 'Nightly load alert ' + runDate + ': ' + flagged.size() + ' run(s) need attention')
    mailer.setMessage(buildBody(flagged, runDate)) // plain text; setHtmlMessage is for HTML
    mailer.send()
    mailer.reset()
}
