import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { ORDER_STATUSES } from '../Everbary/descriptions/OrderDescription';
import { everbaryApiRequest, formEncode } from '../Everbary/GenericFunctions';

/** Deliveries signed longer ago than this are refused, so a captured one cannot be replayed. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

function verifySignature(rawBody: Buffer, header: string, secret: string, now: number): boolean {
	const parts: Record<string, string> = {};
	for (const piece of header.split(',')) {
		const index = piece.indexOf('=');
		if (index > 0) parts[piece.slice(0, index).trim()] = piece.slice(index + 1).trim();
	}
	const timestamp = Number(parts.t);
	const signature = parts.v1 ?? '';
	if (!Number.isFinite(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return false;
	if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
	const expected = createHmac('sha256', secret)
		.update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
		.digest();
	const given = Buffer.from(signature, 'hex');
	return given.length === expected.length && timingSafeEqual(given, expected);
}

export class EverbaryTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'eVerbary Trigger',
		name: 'everbaryTrigger',
		icon: { light: 'file:../../icons/everbary.svg', dark: 'file:../../icons/everbary.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when an eVerbary order changes status',
		defaults: {
			name: 'eVerbary Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'everbaryApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'eVerbary sends status changes of the orders placed with this API key. Each key has one webhook address, so activating this trigger replaces any address the key had before.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['*'],
				description: 'The order status changes to start the workflow on',
				options: [
					{ name: 'Any Status Change', value: '*' },
					...ORDER_STATUSES.filter((status) => status.value !== 'created').map((status) => ({
						name: `Order ${status.name}`,
						value: `order.${status.value as string}`,
					})),
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Verify Signature',
						name: 'verifySignature',
						type: 'boolean',
						default: true,
						description:
							'Whether to reject deliveries whose X-Everbary-Signature does not match the secret eVerbary issued for this webhook',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const staticData = this.getWorkflowStaticData('node');
				const current = await everbaryApiRequest.call(this, 'GET', '/v1/webhook');
				return Boolean(
					current.webhookUrl && current.webhookUrl === webhookUrl && staticData.webhookSecret,
				);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				if (!webhookUrl.startsWith('https://')) {
					throw new NodeOperationError(
						this.getNode(),
						'eVerbary only delivers webhooks to https addresses. Set WEBHOOK_URL on your n8n instance to its public https address.',
					);
				}
				const response = await everbaryApiRequest.call(this, 'PUT', '/v1/webhook', {
					body: formEncode({ url: webhookUrl }),
					json: false,
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				});
				if (!response.webhookSecret) {
					throw new NodeOperationError(
						this.getNode(),
						'eVerbary registered the webhook but did not return its signing secret',
					);
				}
				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookUrl = webhookUrl;
				staticData.webhookSecret = response.webhookSecret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const staticData = this.getWorkflowStaticData('node');
				try {
					const current = await everbaryApiRequest.call(this, 'GET', '/v1/webhook');
					// Only remove the address if it is still ours: another workflow may
					// have taken the key's single webhook over since.
					if (current.webhookUrl === webhookUrl) {
						await everbaryApiRequest.call(this, 'PUT', '/v1/webhook', {
							body: formEncode({ url: '' }),
							json: false,
							headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						});
					}
				} catch (error) {
					this.logger.warn(
						`eVerbary Trigger: could not remove the webhook: ${(error as Error).message}`,
					);
					return false;
				}
				delete staticData.webhookUrl;
				delete staticData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const body = this.getBodyData() as IDataObject;
		const headers = this.getHeaderData() as IDataObject;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const events = this.getNodeParameter('events', []) as string[];

		if (options.verifySignature !== false) {
			const secret = this.getWorkflowStaticData('node').webhookSecret as string | undefined;
			const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;
			const header = String(headers['x-everbary-signature'] ?? '');
			const valid =
				Boolean(secret && rawBody && header) &&
				verifySignature(rawBody as Buffer, header, secret as string, Math.floor(Date.now() / 1000));
			if (!valid) {
				const response = this.getResponseObject();
				response.status(401).json({ error: 'Invalid or missing X-Everbary-Signature' });
				return { noWebhookResponse: true };
			}
		}

		const event = String(headers['x-everbary-event'] ?? body.event ?? '');
		if (!events.includes('*') && !events.includes(event)) {
			return { webhookResponse: { received: true, ignored: event } };
		}

		return {
			workflowData: [this.helpers.returnJsonArray({ ...body, event })],
		};
	}
}
