// Run with: groovy test_alert_logic.groovy (from the alerts folder). No Jedox needed.
// Outside Jedox there's no API, FILE or LOG, so run() skips the Jedox block and only
// defines the pure functions. The test calls readRuns and alertReason, nothing else.
def logic = new GroovyShell().parse(new File('alert_on_failure.groovy'))
logic.run()
def runs = logic.readRuns(new File('job_runs.csv').text)
['2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'].each { d ->
    def flagged = runs.findAll { it.start.startsWith(d) }.collect { r -> def c = new LinkedHashMap(r); c.reason = logic.alertReason(r); c }.findAll { it.reason }
    println(d + ': ' + (flagged ? flagged.collect { it.job + ' ' + it.reason }.join(', ') : 'no email'))
}
