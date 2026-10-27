# Security Specification — Sneha Beauty World

## 1. Data Invariants
1. **Default-Deny Catch-All**: Any path not explicitly matched is strictly denied (`allow read, write: if false;`).
2. **Verified Authentication**: All write operations require a signed-in user with a verified email (`request.auth.token.email_verified == true`).
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates its path ID using `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). `list` operations do not evaluate path IDs or perform `get()`/`exists()` calls.
4. **Identity Integrity**: An `Appointment` or `Inquiry` can only be created if `incoming().clientUid == request.auth.uid`.
5. **Relational Existence**: Creating an `Appointment` requires `exists(/databases/$(database)/documents/services/$(incoming().serviceId))`.
6. **PII Isolation**: `Appointment` and `Inquiry` documents contain client phone numbers and names (PII). Reading (`get` and `list`) is strictly isolated to the document creator (`resource.data.clientUid == request.auth.uid`) or a verified administrator (`isVerifiedAdminEmail()` / `isAdmin()`).
7. **Strict Schema & Volumetric Bounds**: All create and update operations validate against `isValid[Entity](incoming())` enforcing `hasAll`, `hasOnly`, string `.size()` bounds, array `.size()` bounds, and numeric bounds.
8. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on updates; `updatedAt` must equal `request.time` on creation and updates.
9. **Terminal State Locking & Action-Based Updates**: Once an `Appointment` reaches `Completed` or `Cancelled`, non-admin users cannot modify it. All updates must use `incoming().diff(existing()).affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection (`Appointment`)**:
   ```json
   {
     "clientUid": "user_123",
     "clientName": "Priya Sharma",
     "clientPhone": "+919876543210",
     "serviceId": "srv_bridal_hd",
     "serviceTitle": "HD Royal Bridal Makeup",
     "servicePrice": 15999,
     "appointmentDate": "2026-11-15",
     "timeSlot": "10:00 AM",
     "notes": "Morning muhurat",
     "status": "Pending",
     "isVipFree": true
   }
   ```
2. **Identity Spoofing (`Appointment`)**:
   Authenticated as `user_attacker`, attempting to create with `"clientUid": "user_victim"`.
3. **Unverified Email Admin Spoof (`Service`)**:
   Authenticated with `"email": "singhshriyansh51@gmail.com"`, `"email_verified": false`, attempting to update service pricing.
4. **PII Leak via Unauthorized `get` (`Appointment`)**:
   Authenticated as `user_attacker`, attempting `get(/appointments/apt_victim_1)` belonging to `user_victim`.
5. **PII Leak via Unfiltered `list` (`Appointment`)**:
   Authenticated as `user_attacker`, attempting `list(/appointments)` without `where('clientUid', '==', 'user_attacker')`.
6. **Orphaned Foreign Key (`Appointment`)**:
   Creating an appointment referencing `"serviceId": "non_existent_service_999"`.
7. **State Shortcutting on Create (`Appointment`)**:
   Client creating an appointment directly with `"status": "Confirmed"` instead of `"Pending"`.
8. **Terminal State Bypass (`Appointment`)**:
   Client attempting to update `notes` or `status` on an appointment whose existing `status` is `"Cancelled"` or `"Completed"`.
9. **Immortal Field Mutation (`Appointment`)**:
   Client attempting to change `createdAt` or `clientUid` during an update.
10. **Forged Client Timestamp (`Appointment`)**:
    Client passing a past or future timestamp instead of `request.time` for `createdAt` or `updatedAt`.
11. **Denial-of-Wallet Oversized String (`Inquiry`)**:
    Submitting an inquiry with a 10,000-character `message` (exceeding `maxLength: 600`).
12. **Path ID Poisoning (`Service` / `Appointment`)**:
    Attempting to create a document with an invalid ID containing spaces or special characters or >128 chars.
