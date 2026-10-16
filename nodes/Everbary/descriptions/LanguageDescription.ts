import type { INodeProperties } from 'n8n-workflow';

export const languageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['language'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the languages eVerbary translates, with the codes to use in orders',
				action: 'Get many languages',
			},
		],
		default: 'getAll',
	},
];

export const languageFields: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['language'], operation: ['getAll'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['language'], operation: ['getAll'], returnAll: [false] } },
	},
];
