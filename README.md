# n8n-nodes-everbary

This is an n8n community node package. It lets you order certified translations from [eVerbary](https://www.everbary.com) in your n8n workflows, follow each order, and start a workflow when an order changes status.

eVerbary translates official documents (birth and marriage certificates, diplomas, transcripts, court records) with human translators in the US. Every translation comes with a signed certificate of accuracy accepted by USCIS, courts and universities.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Usage](#usage) · [Example workflow](#example-workflow) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation and install `n8n-nodes-everbary`.

## Operations

### eVerbary node

| Resource | Operation | What it does | API |
|---|---|---|---|
| Account | Get | The account the API key belongs to, and whether it is a test key | `GET /v1/me` |
| Language | Get Many | Languages eVerbary translates, with the codes orders use | `GET /v1/languages` |
| Quote | Get | List price and delivery estimate for a language pair and page count, on each turnaround (standard, expedited, expedited plus), and whether expedited plus can be ordered now | `GET /v1/turnaround`, `GET /v1/expedited-plus` |
| Order | Create | Place an order with the documents from a previous node (binary data) | `POST /v1/orders` |
| Order | Get | Status of one order, and its finished files (translation and certificate) once they exist | `GET /v1/orders/{n}` |
| Order | Get Many | The account's most recent orders, newest first, optionally filtered by status | `GET /v1/orders` |
| Order | Advance Sandbox Order | Test keys only: move a sandbox order to its next status now | `POST /v1/sandbox/orders/{n}/advance` |
| Payment Link | Get | The link anyone can use to pay an unpaid order | `GET /v1/orders/{n}` |
| Payment Link | Send | Email an order's payment link to whoever pays | `POST /v1/orders/{n}/send-payment-link` |

**Orders are never paid by this node.** An order is placed unpaid ("pay later") and the response carries its `paymentUrl`. Teams billed on account get the order on their periodic invoice instead. eVerbary staff check the page count of every order, as for orders placed on the website.

**Quotes are list prices.** The API has no quote endpoint yet, so Quote > Get computes the price from eVerbary's published rates ($24.95 a page to or from English, $34.95 a page between two other languages, +20% expedited, +40% expedited plus, $34.90 notarization). Team discounts are not included; the exact total comes back when the order is created.

### eVerbary Trigger node

Starts the workflow when an order placed with your API key changes status (`order.new`, `order.in-progress`, `order.completed`, `order.cancelled` and the rest). When you activate the workflow, the trigger registers its URL with eVerbary (`PUT /v1/webhook`) and keeps the signing secret eVerbary returns. Every delivery is checked against its `X-Everbary-Signature` header (HMAC-SHA256, deliveries older than 5 minutes are refused). Deactivating the workflow removes the URL.

Things to know:

- eVerbary keeps **one webhook address per API key**. Activating the trigger replaces whatever address the key had. Use a separate key for n8n if another system already receives this key's webhooks.
- eVerbary only delivers to **https** addresses, so your n8n instance needs a public https URL (n8n Cloud has one; self-hosted instances set `WEBHOOK_URL`).
- Webhooks cover orders placed through the API with that key.

## Credentials

You need an eVerbary API key.

1. Ask [support@everbary.com](mailto:support@everbary.com) for a key, or create one from your eVerbary account (see [eVerbary for developers](https://www.everbary.com/integrations/api)).
2. In n8n, create an **eVerbary API** credential and paste the key. Leave **Base URL** as `https://orders.everbary.com`.
3. n8n checks the key against `GET /v1/me` when you save.

Keys that start with `ev_test_` use the **sandbox**: orders are pretend, nothing is charged, emailed or sent to a translator, and each order moves `new` → `in-progress` (about a minute) → `completed` (two minutes later) with a sample translation attached, firing your webhook at every step. Sandbox orders are numbered from 900001. Keys that start with `ev_live_` place real orders.

## Usage

### Attaching documents

Order > Create sends the files in the input item's binary fields. Set **Input Binary Fields** to the field names, separated by commas (`data` by default, `data, data2` for two files). PDF, images and Word files up to 50 MB each are accepted. Any node that outputs binary data works as the source: Read/Write Files from Disk, Google Drive, Dropbox, an email attachment, an HTTP Request download, a Form Trigger upload.

### Avoiding duplicate orders

Every Create request carries an `Idempotency-Key`. By default it is derived from the execution, the node and the item, so if n8n retries the same execution (Retry On Fail) eVerbary returns the first order instead of placing a second one. Set **Additional Fields > Idempotency Key** to your own value (a case or matter ID, for example) to deduplicate across executions.

### Language codes

Language fields list the languages from the API. In expressions use the codes from Language > Get Many, e.g. `spanish`, `portuguese`, `chineseSimp`, `english`.

## Example workflow

Translate a birth certificate that arrives in Google Drive and email the paralegal when it is done:

1. **Google Drive Trigger** (file created in a folder) → **Google Drive** (download the file, binary field `data`).
2. **eVerbary** – Order > Create: Email `paralegal@yourfirm.com`, First/Last Name, Source Language `Spanish`, Target Language `English`, Pages `1`, Input Binary Fields `data`, Additional Fields > Case Number `{{ $json.name }}`.
3. **eVerbary** – Payment Link > Send (optional): Order Number `{{ $json.orderNumber }}`, To the client's email.

A second workflow picks up the result:

1. **eVerbary Trigger** – Events: `Order Completed`.
2. **HTTP Request** – download `{{ $json.deliverables[0].url }}` (the translation) as a file.
3. **Gmail** – send it to the paralegal.

[`examples/sandbox-order.json`](examples/sandbox-order.json) is a ready-to-import workflow that downloads a sample PDF, gets a quote and places an order. Import it, pick your eVerbary credential and run it.

Try it with an `ev_test_` key first: the sandbox order completes on its own in about three minutes, or use Order > Advance Sandbox Order to skip the wait.

## Compatibility

Built with `@n8n/node-cli` 0.52 and tested on n8n 2.x. Requires n8n 1.0 or later.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [eVerbary Order API reference](https://orders.everbary.com/v1/docs)
- [eVerbary for developers](https://www.everbary.com/integrations/api)
- [eVerbary pricing](https://www.everbary.com/pricing)
- Support: [support@everbary.com](mailto:support@everbary.com)

## Version history

### 0.1.0

First release: Account, Language, Quote, Order and Payment Link resources, and the eVerbary Trigger.

## License

[MIT](LICENSE.md) © eVerbary, LLC
