---
title: "Move your Jedox Snowflake connection from password to key pair"
description: "Snowflake is blocking password sign-ins for service users. Switch an existing Jedox connection to key-pair authentication in four steps, without a broken load in between."
date: 2026-11-09
social_image: key-pair-migration.png
---

# Move your Jedox Snowflake connection from password to key pair

<p class="post-meta">Snowflake · Intermediate · ~20 min</p>

<aside class="docs-note" role="note">
  <p class="docs-note__title">Checked against the official docs · not yet run on a live system</p>
  <p>Key-pair setup, user types, and the password-deprecation timeline follow the Snowflake docs linked in the steps. The Jedox connection UI follows the public Jedox knowledge base. Sample login times and the 2026-03 totals are fictional FDH_DEMO figures, not a live run.</p>
</aside>

If your Jedox job signs in to Snowflake with a user name and password, it is on a clock. Snowflake is rolling out a change that blocks password sign-ins for every non-human user. When it reaches your account, the nightly load simply stops logging in.

The fix is a key pair, and the move takes about four steps. The trick is doing them in the right order, so there is never a night where neither the old password nor the new key works.

This post is for an **existing** connection. If you are setting up Jedox and Snowflake from scratch, start with [From Snowflake to Jedox](../jedox/snowflake-to-jedox.md), which creates the service user with a key from day one. We use the same fictional names here: the user `JEDOX_SVC`, the role `JEDOX_ETL_ROLE`, the warehouse `JEDOX_ETL_WH`, and the Jedox connection `SNOWFLAKE_DEMO`.

> **Which Integrator UI?** The steps use the **legacy** Integrator UI.

<p class="diagram-swipe">Swipe to see the full diagram →</p>
<div class="diagram-frame">
<figure class="diagram-scroll" style="--diagram-min-width: 700px" tabindex="0" aria-label="Password to key-pair migration in four steps">
  <img src="../06-keypair-diagram.svg" alt="Before: JEDOX_SVC with password. After: JEDOX_SVC with key pair. Steps 1 Create the key, 2 Add it to the user, 3 Switch the connection, 4 Remove the password and set TYPE = SERVICE." width="840" height="500">
</figure>
<span class="diagram-chevron" aria-hidden="true">›</span>
</div>

---

## What's changing, and when

Snowflake splits users into people (`TYPE = PERSON`) and services (`TYPE = SERVICE`). A third type, `LEGACY_SERVICE`, was a stopgap that still let a service user sign in with a password. Snowflake's [deprecation plan](https://docs.snowflake.com/en/user-guide/security-mfa-rollout) removes it in phases (estimated dates; subject to change):

| Estimated dates | What happens |
|---|---|
| May 2026 to Jul 2026 | No new `LEGACY_SERVICE` users. You cannot create one or change an existing user to that type. |
| Aug 2026 to Oct 2026 | Service users can no longer sign in with a password. Every `LEGACY_SERVICE` user is converted to `TYPE = SERVICE`. |

Each phase reaches accounts on a rolling basis. Snowflake notifies you of your account's date, shows it in the [Strong Authentication Hub](https://docs.snowflake.com/en/user-guide/strong-authentication-hub), and may extend it where complex workloads need more time. As of this post (9 Nov 2026), the estimated Phase 3 window (Aug–Oct 2026) has passed; enforcement dates are account-specific and may be extended. Check the Strong Authentication Hub for your account's date. If your service user still has a password, do this now.

Testing on a trial account? The same deprecation page says these phases do not apply to trial or reader accounts (or Snowflake Postgres), so you will not see the password block there. Your production account still gets it.

Jedox users asked for key-pair sign-in when the Snowflake connector was requested ([JS-I-762](https://feedback.jedox.com/ideas/JS-I-762)). Today the [Snowflake connection](https://knowledgebase.jedox.com/integration/connections/snowflake-connection.htm) offers Method = Private key, which is what the launch post uses.

## Before you start: find who's affected

Start with a list, because the Jedox user is rarely the only one. Excel ODBC connections, Power BI service users, and other ETL tools often sign in the same way.

```sql
USE ROLE SECURITYADMIN;

SHOW USERS;

SELECT "name", "type", "has_password", "has_rsa_public_key", "last_success_login"
FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))
WHERE "type" = 'LEGACY_SERVICE' OR (TO_BOOLEAN("has_password") AND "name" LIKE '%\\_SVC' ESCAPE '\\')
ORDER BY "last_success_login" DESC;
```

`TO_BOOLEAN` makes the filter work whether your client shows those flags as text or as true/false. In `LIKE`, a bare `_` matches any single character, so the pattern escapes it (`\_`) to match a real underscore. The filter skips users that are already `SERVICE` with no password, because those are done.

In the fictional FDH_DEMO account it returns two users. The login times are made up for the example.

| name | type | has_password | has_rsa_public_key | last_success_login |
|---|---|---|---|---|
| JEDOX_SVC | LEGACY_SERVICE | true | false | 2026-03-31 06:15:00 |
| EXCEL_ODBC_SVC | LEGACY_SERVICE | true | false | 2026-03-31 08:40:00 |

Anything with a password and no key is on your list. Users that sign in with a password but have no `TYPE` set are treated as people, so they will be asked for MFA instead. If one of those is really a job, it belongs on the list too.

## What you'll build

- A PKCS#8 private key kept only on the Jedox server (never in the repo)
- `JEDOX_SVC` with `RSA_PUBLIC_KEY` set, then `TYPE = SERVICE` and no password
- The `SNOWFLAKE_DEMO` connection switched to Method = Private key
- A login-history check that the last successful factor is key-pair, not password

## 1. Create the key

Generate the key pair on the Jedox server, the same way as in the launch post's [service user section](../jedox/snowflake-to-jedox.md#1-create-a-service-user-for-jedox). Snowflake requires at least a 2048-bit RSA key ([key-pair authentication](https://docs.snowflake.com/en/user-guide/key-pair-auth)):

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out jedox_svc_key.p8 -nocrypt
openssl rsa -in jedox_svc_key.p8 -pubout -out jedox_svc_key.pub
```

This key has no passphrase, and that is on purpose: the [Jedox Snowflake connection](https://knowledgebase.jedox.com/integration/connections/snowflake-connection.htm) settings list Method = Private key but no passphrase field, so Jedox may not open an encrypted key. Only if your connection form has a passphrase field, generate an encrypted key instead (`-v2 aes-256-cbc` in place of `-nocrypt`, matching the Snowflake docs).

Protect the unencrypted file instead:

- On Linux: `chmod 600 jedox_svc_key.p8` and own it by the Jedox service account (`chown jedox_svc jedox_svc_key.p8`, or whichever account runs Jedox).
- On Windows: remove inherited permissions so only that Jedox service account (and Administrators) can read it.
- Keep it on the Jedox server only — off shared drives and backups that others can read.
- Never commit the private key, a passphrase, or a real public key into the repo. Add `*.p8` and `*.pem` to `.gitignore`. The SQL downloads use the placeholder `MIIB...REPLACE_ME`.
- `JEDOX_SVC` keeps only the least-privilege role `JEDOX_ETL_ROLE` from the launch post.
- Rotate the key regularly with `RSA_PUBLIC_KEY_2` (see [Rotating the key later](#rotating-the-key-later)).

## 2. Add it to the user

Put the public key on the existing user. Nothing breaks yet: the password still works, so the nightly load keeps running while you test.

```sql
USE ROLE SECURITYADMIN;
ALTER USER JEDOX_SVC SET RSA_PUBLIC_KEY = 'MIIB...REPLACE_ME';
DESC USER JEDOX_SVC;
```

The role needs OWNERSHIP or MODIFY PROGRAMMATIC AUTHENTICATION METHODS on the user. SECURITYADMIN usually covers users owned by USERADMIN through the system role hierarchy. If `JEDOX_SVC` is owned by a different role, run these `ALTER USER` steps as that owner role.

Paste the key body from `jedox_svc_key.pub` without the BEGIN and END lines. In the `DESC USER` output, `RSA_PUBLIC_KEY_FP` should now show a fingerprint ([key-pair authentication](https://docs.snowflake.com/en/user-guide/key-pair-auth)).

A `LEGACY_SERVICE` user still allows password authentication while you switch. Key-pair sign-in is not limited to one user type, so the user can have both set during the move.

Snowflake recommends named keys (`ALTER USER … ADD KEY PAIR`; GA [15 Jul 2026](https://docs.snowflake.com/en/release-notes/2026/other/2026-07-15-named-key-pair-management)). `RSA_PUBLIC_KEY` / `RSA_PUBLIC_KEY_2` remain supported and are what this post uses to match the launch post. Named keys add role restriction and expiry if you need them later.

## 3. Switch the connection

In Jedox, open the Integrator project and the `SNOWFLAKE_DEMO` connection:

| Setting | Before | After |
|---|---|---|
| Method | User name and password | Private key |
| User | `JEDOX_SVC` | `JEDOX_SVC` |
| Private key | (none) | the `.p8` key from step 1 |
| Role, Warehouse, Database | unchanged | unchanged |

Test the connection, then run the actuals job once for a single month. The totals should match what they were before: for 2026-03 in the sample data, **58 rows totaling 1,466,143.86**.

Check in your Integrator whether it asks for a file path or the key text. Only if your form has a passphrase field and you used an encrypted key, enter the passphrase there. Keys stay on the server; they are not part of this site's downloads.

Then confirm in Snowflake that the run really used the key and did not quietly fall back to the password. Run it as a role that can monitor `JEDOX_SVC`, for example `SECURITYADMIN`. `LOGIN_HISTORY_BY_USER` covers the last 7 days ([LOGIN_HISTORY](https://docs.snowflake.com/en/sql-reference/functions/login_history)). The full name `FDH_DEMO.INFORMATION_SCHEMA` sets the database, so the query works even with no database in context:

```sql
USE ROLE SECURITYADMIN;
SELECT event_timestamp, user_name, first_authentication_factor, is_success, error_message
FROM TABLE(FDH_DEMO.INFORMATION_SCHEMA.LOGIN_HISTORY_BY_USER(USER_NAME => 'JEDOX_SVC', RESULT_LIMIT => 100))
ORDER BY event_timestamp DESC;
```

In `FIRST_AUTHENTICATION_FACTOR`, the newest successful rows should show a key-pair value (commonly `RSA_KEYPAIR` in practice — confirm against your own output; the function docs describe the column but do not list every factor string).

### Other clients

Jedox is the walkthrough above. Each tool gets its own service user and its own key pair (for example `EXCEL_ODBC_SVC` for Excel), with only the role it needs. Never copy `JEDOX_SVC`'s private key to another tool.

- **Python connector:** set `authenticator='SNOWFLAKE_JWT'`, `private_key_file` to the path of the `.p8` file, and `private_key_password` only when the key is encrypted ([Python connector](https://docs.snowflake.com/en/developer-guide/python-connector/python-connector-connect)). Load the passphrase from an environment variable or secret store, never from source or config files in the repo.
- **JDBC (and tools that wrap it):** set `authenticator=snowflake_jwt` with `private_key_file` (and `private_key_pwd` when encrypted), or pass a `privatekey` object ([JDBC parameters](https://docs.snowflake.com/en/developer-guide/jdbc/jdbc-parameters)). Jedox's Private key method sits on this driver path. Load the passphrase from an environment variable or secret store, never from source or config files in the repo.
- **Power BI:** Snowflake lists key-pair authentication as supported for Power BI Cloud and Desktop for both person and service users ([partner authentication support](https://docs.snowflake.com/en/user-guide/partner-authentication-support)). In the Power BI service, choose **KeyPair** for the Snowflake data-source credential and give it the Power BI service user's own key. Store the key only in that credential, never in a `.pbix`, a shared folder or the repo ([Connect to Snowflake with Power BI](https://learn.microsoft.com/en-us/power-bi/connect-data/service-connect-snowflake)). Exact KeyPair form fields (file upload vs PEM paste) are a Power BI UI detail — follow Microsoft's connector UI.

Excel ODBC follows the same pattern as other ODBC clients that support key pairs ([supported clients table](https://docs.snowflake.com/en/user-guide/key-pair-auth)): give Excel its own service user and key, point the driver at that private key file, then remove the password only after a successful key login.

## 4. Remove the password

Only once the key login works, take the password away and make the user a proper service user. Clear the password first, then set the type:

```sql
USE ROLE SECURITYADMIN;
ALTER USER JEDOX_SVC SET PASSWORD = NULL;
ALTER USER JEDOX_SVC SET TYPE = SERVICE;
```

Setting `PASSWORD` to `NULL` is how the [password authentication](https://docs.snowflake.com/en/user-guide/password-authentication) docs describe removing a password when the user no longer needs one. A `SERVICE` user cannot authenticate with a password ([user management](https://docs.snowflake.com/en/user-guide/admin-user-management); [ALTER USER](https://docs.snowflake.com/en/sql-reference/sql/alter-user)).

You would get there anyway when Snowflake converts the user, but doing it yourself means you pick the day, and you find out now if some other tool was still using that password.

`JEDOX_SVC` keeps only `JEDOX_ETL_ROLE`, which reads views. This migration adds no broader grants.

## Rotating the key later

Snowflake lets a user hold two public keys on the legacy properties, so you can rotate without downtime ([key-pair rotation](https://docs.snowflake.com/en/user-guide/key-pair-auth)). Set the new key as the second one, switch the Jedox connection to the new private key and test it, then remove the old key:

```sql
USE ROLE SECURITYADMIN;
ALTER USER JEDOX_SVC SET RSA_PUBLIC_KEY_2 = 'MIIB...REPLACE_ME';
-- switch the Jedox connection to the new private key and test it, then:
ALTER USER JEDOX_SVC UNSET RSA_PUBLIC_KEY;
```

If you later move to named keys, use `ALTER USER ... ROTATE KEY PAIR` instead; the prior key stays valid for a configurable grace period (default 24 hours).

## When it goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| A password login error for a service user, after Snowflake's enforcement date | The user still relies on a password | Do steps 1 to 3 now |
| A JWT or key error, while the password still works | Public key pasted with BEGIN/END lines, or a different key pair | Re-paste the key body, compare the fingerprint |
| Login fails right after step 4 | The connection was never switched, or another tool shares the user | Check the login history; give each tool its own user |

The exact error texts are not fully listed in the docs, so match on the kind of error, not the wording. See also [Key Pair Authentication: Troubleshooting](https://docs.snowflake.com/en/user-guide/key-pair-auth-troubleshooting).

## What about OAuth?

Jedox 2023.4 and later also support OAuth for Snowflake, through Method = Token plus a separate OAuthToken connection ([Snowflake connection](https://knowledgebase.jedox.com/integration/connections/snowflake-connection.htm)). We stick to key pairs because they need no extra token connection and no OAuth setup in Snowflake.

## Wrap-up

The order is the whole trick: create the key, add it to the user next to the password, switch and test the connection, and only then remove the password. Do the same for every user on your list from "Before you start", ideally before Snowflake does it for you.

## Downloads

All files use synthetic sample data and placeholder names. The public key in the SQL is a placeholder; never publish a private key or passphrase.

[[download:keypair/find_affected_users.sql|Download find_affected_users.sql]]
[[download:keypair/migrate_jedox_svc.sql|Download migrate_jedox_svc.sql]]
[[download:keypair/verify_keypair_logins.sql|Download verify_keypair_logins.sql]]
