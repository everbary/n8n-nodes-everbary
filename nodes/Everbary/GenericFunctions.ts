import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const DEFAULT_BASE_URL = 'https://orders.everbary.com';

type EverbaryContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions;

export async function getBaseUrl(this: EverbaryContext): Promise<string> {
	const credentials = await this.getCredentials('everbaryApi');
	const raw = String(credentials.baseUrl || DEFAULT_BASE_URL).trim();
	return raw.replace(/\/+$/, '');
}

/**
 * The API answers errors as `{"detail": "..."}` (or a list of validation
 * problems for a 422). Turn that into one readable sentence.
 */
function describeApiError(error: JsonObject): string | undefined {
	const response = (error.response ?? {}) as JsonObject;
	const context = (error.context ?? {}) as JsonObject;
	const cause = (error.cause ?? {}) as JsonObject;
	const causeResponse = (cause.response ?? {}) as JsonObject;
	let body = (context.data ??
		response.body ??
		response.data ??
		causeResponse.data ??
		error.body) as unknown;
	if (typeof body === 'string') {
		const text = body;
		try {
			body = JSON.parse(text);
		} catch {
			return text || undefined;
		}
	}
	if (!body || typeof body !== 'object') return undefined;
	const detail = (body as IDataObject).detail ?? (body as IDataObject).message;
	if (typeof detail === 'string') return detail;
	if (Array.isArray(detail)) {
		return detail
			.map((d) => {
				const item = d as IDataObject;
				const loc = Array.isArray(item.loc) ? item.loc.filter((l) => l !== 'body').join('.') : '';
				return loc ? `${loc}: ${String(item.msg)}` : String(item.msg);
			})
			.join('; ');
	}
	return undefined;
}

export async function everbaryApiRequest(
	this: EverbaryContext,
	method: IHttpRequestMethods,
	path: string,
	options: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
	const baseUrl = await getBaseUrl.call(this);
	const request: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		json: true,
		...options,
		headers: {
			Accept: 'application/json',
			...(options.headers ?? {}),
		},
	};
	try {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'everbaryApi',
			request,
		)) as IDataObject | string | Buffer;
		if (typeof response === 'string' || Buffer.isBuffer(response)) {
			const text = response.toString();
			return (text ? JSON.parse(text) : {}) as IDataObject;
		}
		return response;
	} catch (error) {
		const message = describeApiError(error as JsonObject);
		if (error instanceof NodeApiError) {
			// n8n has already wrapped it (and would hand the same object back if
			// wrapped again), so put the API's own explanation in its message.
			const apiError = error;
			if (message) {
				if (!apiError.description) apiError.description = apiError.message;
				apiError.message = message;
			}
			throw apiError;
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, message ? { message } : {});
	}
}

/** Encode a flat object as application/x-www-form-urlencoded. */
export function formEncode(fields: IDataObject): string {
	return Object.entries(fields)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
		.join('&');
}

/**
 * The API's code for a language given as a code or a name in any case and
 * spacing ("Spanish", "spanish", "Chinese (Simplified)", "chinesesimp").
 * AI agents and expressions often send the name; the API only takes the code.
 */
export function matchLanguageCode(input: string, languages: IDataObject[]): string | undefined {
	const key = (value: unknown) =>
		String(value ?? '')
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '');
	const wanted = key(input);
	if (!wanted) return undefined;
	const hit = languages.find((language) => key(language.code) === wanted || key(language.name) === wanted);
	return hit ? String(hit.code) : undefined;
}

export async function getLanguageOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const response = await everbaryApiRequest.call(this, 'GET', '/v1/languages');
	const languages = (response.languages ?? []) as IDataObject[];
	return languages
		.map((language) => ({
			name: String(language.name ?? language.code),
			value: String(language.code),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}
