-- Finance Data Hub: move JEDOX_SVC from password to key pair
-- Placeholder public key only. Never paste a private key or passphrase into SQL.
-- Keys live outside the repo (Jedox server / secret store).
USE ROLE SECURITYADMIN;
-- If JEDOX_SVC is owned by a different role, run these ALTER USER steps as that owner role.

-- Step 2: add the public key (password keeps working for now)
ALTER USER JEDOX_SVC SET RSA_PUBLIC_KEY = 'MIIB...REPLACE_ME';

-- Check the key landed: RSA_PUBLIC_KEY_FP should now have a value
DESC USER JEDOX_SVC;

-- Step 3 happens in Jedox: switch the connection to Method = Private key and test it.

-- Step 4: only after the key login works, clear the password, then set the type
ALTER USER JEDOX_SVC SET PASSWORD = NULL;
ALTER USER JEDOX_SVC SET TYPE = SERVICE;

-- Later, key rotation: new key as RSA_PUBLIC_KEY_2, switch the Jedox connection and test, then unset the old key
-- ALTER USER JEDOX_SVC SET RSA_PUBLIC_KEY_2 = 'MIIB...REPLACE_ME';
-- ALTER USER JEDOX_SVC UNSET RSA_PUBLIC_KEY;
