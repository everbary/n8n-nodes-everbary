import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class EverbaryApi implements ICredentialType {
	name = 'everbaryApi';

	displayName = 'eVerbary API';

	icon: Icon = { light: 'file:../icons/everbary.svg', dark: 'file:../icons/everbary.svg' };

	documentationUrl = 'https://github.com/everbary/n8n-nodes-everbary#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your eVerbary API key. Keys that start with ev_test_ use the sandbox: orders are pretend and nothing is charged. Live keys start with ev_live_.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://orders.everbary.com',
			description: 'Leave as is unless eVerbary support gives you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/me',
			method: 'GET',
		},
	};
}
