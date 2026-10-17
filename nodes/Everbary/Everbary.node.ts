import { createHash, randomUUID } from 'crypto';
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { accountFields, accountOperations } from './descriptions/AccountDescription';
import { languageFields, languageOperations } from './descriptions/LanguageDescription';
import { orderFields, orderOperations } from './descriptions/OrderDescription';
import { paymentLinkFields, paymentLinkOperations } from './descriptions/PaymentLinkDescription';
import { quoteFields, quoteOperations } from './descriptions/QuoteDescription';
import {
	everbaryApiRequest,
	formEncode,
	getLanguageOptions,
	matchLanguageCode,
} from './GenericFunctions';
import { listPrice, type Turnaround } from './pricing';

const ORDER_BOOLEAN_FIELDS = ['expedited', 'expedited_plus', 'notarization'];
const ORDER_TEXT_FIELDS = [
	'reference',
	'note',
	'case_number',
	'client_first_name',
	'client_last_name',
	'source',
];

interface MultipartFile {
	fileName: string;
	mimeType: string;
	data: Buffer;
}

function multipartBody(fields: IDataObject, files: MultipartFile[]) {
	const boundary = `----everbary-n8n-${randomUUID()}`;
	const chunks: Buffer[] = [];
	const quote = (value: string) => value.replace(/["\r\n]/g, '_');
	for (const [name, value] of Object.entries(fields)) {
		if (value === undefined || value === null || value === '') continue;
		chunks.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${quote(name)}"\r\n\r\n${String(value)}\r\n`,
			),
		);
	}
	for (const file of files) {
		chunks.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${quote(file.fileName)}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
			),
			file.data,
			Buffer.from('\r\n'),
		);
	}
	chunks.push(Buffer.from(`--${boundary}--\r\n`));
	return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

export class Everbary implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'eVerbary',
		name: 'everbary',
		icon: { light: 'file:../../icons/everbary.svg', dark: 'file:../../icons/everbary.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Order certified translations (USCIS, courts, universities) from eVerbary and follow them',
		defaults: {
			name: 'eVerbary',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'everbaryApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Language', value: 'language' },
					{ name: 'Order', value: 'order' },
					{ name: 'Payment Link', value: 'paymentLink' },
					{ name: 'Quote', value: 'quote' },
				],
				default: 'order',
			},
			...accountOperations,
			...accountFields,
			...languageOperations,
			...languageFields,
			...orderOperations,
			...orderFields,
			...paymentLinkOperations,
			...paymentLinkFields,
			...quoteOperations,
			...quoteFields,
		],
	};

	methods = {
		loadOptions: {
			getLanguages: getLanguageOptions,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let result: IDataObject | IDataObject[];

				if (resource === 'account' && operation === 'get') {
					result = await everbaryApiRequest.call(this, 'GET', '/v1/me');
				} else if (resource === 'language' && operation === 'getAll') {
					const response = await everbaryApiRequest.call(this, 'GET', '/v1/languages');
					let languages = (response.languages ?? []) as IDataObject[];
					if (!this.getNodeParameter('returnAll', i)) {
						languages = languages.slice(0, this.getNodeParameter('limit', i) as number);
					}
					result = languages;
				} else if (resource === 'quote' && operation === 'get') {
					result = await getQuote.call(this, i);
				} else if (resource === 'order') {
					result = await runOrderOperation.call(this, operation, i);
				} else if (resource === 'paymentLink') {
					result = await runPaymentLinkOperation.call(this, operation, i);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex: i },
					);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(result),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeApiError || error instanceof NodeOperationError) {
					// Already an n8n error with the API's message: just say which item failed.
					const nodeError = error;
					nodeError.context = { ...(nodeError.context ?? {}), itemIndex: i };
					throw nodeError;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

/**
 * Source and target language as the API's codes. Accepts a code or a name in
 * any case ("Spanish" from an AI agent becomes "spanish").
 */
async function resolveLanguages(this: IExecuteFunctions, i: number): Promise<[string, string]> {
	const rawFrom = String(this.getNodeParameter('languageFrom', i) ?? '').trim();
	const rawTo = String(this.getNodeParameter('languageTo', i) ?? '').trim() || 'english';
	const response = await everbaryApiRequest.call(this, 'GET', '/v1/languages');
	const languages = (response.languages ?? []) as IDataObject[];
	const resolved = [rawFrom, rawTo].map((raw) => {
		const code = matchLanguageCode(raw, languages);
		if (!code) {
			throw new NodeOperationError(
				this.getNode(),
				`Unknown language "${raw}". Use Language > Get Many for the accepted codes.`,
				{ itemIndex: i },
			);
		}
		return code;
	}) as [string, string];
	if (resolved[0] === resolved[1]) {
		throw new NodeOperationError(this.getNode(), 'The source and target languages are the same', {
			itemIndex: i,
		});
	}
	return resolved;
}

async function getQuote(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const pages = this.getNodeParameter('pages', i) as number;
	const notarization = this.getNodeParameter('notarization', i) as boolean;

	if (!Number.isInteger(pages) || pages < 1) {
		throw new NodeOperationError(this.getNode(), 'Pages must be a whole number of at least 1', {
			itemIndex: i,
		});
	}
	const [languageFrom, languageTo] = await resolveLanguages.call(this, i);

	const [turnaround, plus] = await Promise.all([
		everbaryApiRequest.call(this, 'GET', '/v1/turnaround', { qs: { pages } }),
		everbaryApiRequest.call(this, 'GET', '/v1/expedited-plus', {
			qs: { language_from: languageFrom, language_to: languageTo },
		}),
	]);

	const etas = (turnaround.options ?? {}) as IDataObject;
	const plusAvailable = plus.available !== false;
	const options: IDataObject = {};
	for (const level of ['standard', 'expedited', 'expeditedPlus'] as Turnaround[]) {
		const eta = (etas[level] ?? {}) as IDataObject;
		const available = level === 'expeditedPlus' ? plusAvailable : true;
		options[level] = {
			...listPrice(languageFrom, languageTo, pages, level, notarization),
			eta: eta.label ?? turnaround[level] ?? null,
			etaHours: eta.hours ?? null,
			arrivesAt: eta.arrivesAt ?? null,
			available,
			unavailableReason: available ? null : (plus.reason ?? null),
		};
	}

	return {
		languageFrom,
		languageTo,
		pages,
		notarization,
		currency: 'USD',
		options,
		note: 'List prices before any team discount. The order response carries the exact total.',
	};
}

async function runOrderOperation(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'create') {
		const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const pages = this.getNodeParameter('pages', i) as number;
		if (!Number.isInteger(pages) || pages < 1) {
			throw new NodeOperationError(this.getNode(), 'Pages must be a whole number of at least 1', {
				itemIndex: i,
			});
		}

		const [languageFrom, languageTo] = await resolveLanguages.call(this, i);
		const fields: IDataObject = {
			email: (this.getNodeParameter('email', i) as string).trim(),
			first_name: this.getNodeParameter('firstName', i) as string,
			last_name: this.getNodeParameter('lastName', i) as string,
			language_from: languageFrom,
			language_to: languageTo,
			pages,
		};
		for (const name of ORDER_BOOLEAN_FIELDS) {
			fields[name] = additional[name] ? 'true' : 'false';
		}
		for (const name of ORDER_TEXT_FIELDS) {
			if (additional[name] !== undefined && additional[name] !== '') {
				fields[name] = String(additional[name]);
			}
		}
		if (fields.source === undefined) fields.source = 'n8n';

		const names = (this.getNodeParameter('binaryPropertyNames', i) as string)
			.split(',')
			.map((name) => name.trim())
			.filter((name) => name);
		if (!names.length) {
			throw new NodeOperationError(
				this.getNode(),
				'Give at least one input binary field that holds a document',
				{ itemIndex: i },
			);
		}
		const files: MultipartFile[] = [];
		for (const name of names) {
			const binary = this.helpers.assertBinaryData(i, name);
			files.push({
				fileName: binary.fileName || `${name}.${binary.fileExtension || 'pdf'}`,
				mimeType: binary.mimeType || 'application/octet-stream',
				data: await this.helpers.getBinaryDataBuffer(i, name),
			});
		}

		let idempotencyKey = String(additional.idempotencyKey ?? '').trim();
		if (!idempotencyKey) {
			const executionId = this.getExecutionId();
			idempotencyKey = executionId
				? createHash('sha256').update(`n8n:${executionId}:${this.getNode().id}:${i}`).digest('hex')
				: randomUUID();
		}

		const { body, contentType } = multipartBody(fields, files);
		return await everbaryApiRequest.call(this, 'POST', '/v1/orders', {
			body,
			json: false,
			headers: { 'Content-Type': contentType, 'Idempotency-Key': idempotencyKey },
		});
	}

	if (operation === 'get') {
		const orderNumber = this.getNodeParameter('orderNumber', i) as number;
		return await everbaryApiRequest.call(this, 'GET', `/v1/orders/${orderNumber}`);
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		const qs: IDataObject = {
			limit: returnAll ? 100 : (this.getNodeParameter('limit', i) as number),
		};
		if (filters.status) qs.status = filters.status;
		const response = await everbaryApiRequest.call(this, 'GET', '/v1/orders', { qs });
		return (response.orders ?? []) as IDataObject[];
	}

	if (operation === 'advance') {
		const orderNumber = this.getNodeParameter('orderNumber', i) as number;
		const to = this.getNodeParameter('to', i, '') as string;
		return await everbaryApiRequest.call(
			this,
			'POST',
			`/v1/sandbox/orders/${orderNumber}/advance`,
			{
				body: formEncode({ to }),
				json: false,
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			},
		);
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported`, {
		itemIndex: i,
	});
}

async function runPaymentLinkOperation(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	const orderNumber = this.getNodeParameter('orderNumber', i) as number;

	if (operation === 'get') {
		const order = await everbaryApiRequest.call(this, 'GET', `/v1/orders/${orderNumber}`);
		return {
			orderNumber: order.orderNumber,
			paymentUrl: order.paymentUrl ?? null,
			payment: order.payment,
			paid: order.paid,
			total: order.total,
			discountedTotal: order.discountedTotal,
			...(order.sandbox ? { sandbox: true } : {}),
		};
	}

	if (operation === 'send') {
		const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const fields: IDataObject = { to: (this.getNodeParameter('to', i) as string).trim() };
		for (const name of ['subject', 'body', 'reply_to', 'from_name']) {
			if (additional[name]) fields[name] = additional[name];
		}
		return await everbaryApiRequest.call(
			this,
			'POST',
			`/v1/orders/${orderNumber}/send-payment-link`,
			{
				body: formEncode(fields),
				json: false,
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			},
		);
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported`, {
		itemIndex: i,
	});
}
