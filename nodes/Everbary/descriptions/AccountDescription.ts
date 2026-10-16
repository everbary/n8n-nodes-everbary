import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get the account the API key belongs to and whether it is a test key',
				action: 'Get the account',
			},
		],
		default: 'get',
	},
];

export const accountFields: INodeProperties[] = [];
