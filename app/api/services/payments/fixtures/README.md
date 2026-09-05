# Provider fixtures (§11.3)

Recorded and hand-reduced provider payloads. They exist so that the awkward
shapes named in the spec — a Casso `when` that is date-only, a PayOS
`description` truncated mid-token, an amount as a string rather than a number, a
missing `counterAccountNumber` — are asserted against a captured payload rather
than against a payload we invented to match our own parser.

Every value here is synthetic. Account numbers, names and references are made
up; no real counterparty, transaction or key appears in this directory, and
none may be added to it. A captured sandbox payload gets its identifiers
replaced before it lands here.
