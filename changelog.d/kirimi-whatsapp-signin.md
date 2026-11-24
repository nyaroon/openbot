### Added

- Owner-managed accounts and closed registration. When the account service has `OWNER_WHATSAPP_NUMBERS` set, only an owner number, a number that already has an account, or a number with a pending invitation can start sign-in. Other numbers get the message "This number has no account. Ask the owner to add it." Owners get an Accounts tab in Settings, on desktop and on the web, to create accounts by WhatsApp number and see the list. Without the setting, registration stays open.

### Changed

- Sign-in and server invitations now use a WhatsApp number instead of an email address. With reverse sign-in, a person signs in by sending a prepared WhatsApp message to the business number.
- A server allows up to 50 members, with no plan or licence check. An operator can set another limit for one server.

### Removed

- Company sign-in (single sign-on and SCIM) is removed.
- The invite-a-friend referral programme is removed: invite links, referral credit, the Invite friends settings tab and the referral landing page.
- OpenBot credits are removed: buying, moving and spending them, the Credits page and rail button, and the OpenBot image and video models that they paid for. Sunra, Higgsfield and agent provider media keep working with their own accounts.
- Hosted servers and hosted sites are removed: the cloud servers that OpenBot rented by plan, publishing sites to OpenBot hosting, the site publish tool, and their pricing page, settings and status entries. Self-hosted servers, joining by invitation, and local site preview stay.
- Licences, billing and plans are removed: commercial licences, Stripe checkout and the customer portal, server and storage plans, the Billing and Licence settings, the pricing and checkout pages, and every prompt to pay, upgrade or add seats.
