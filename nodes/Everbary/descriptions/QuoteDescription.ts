import type { INodeProperties } from 'n8n-workflow';

export const quoteOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['quote'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description:
					'Estimate the price and delivery time of a translation on each turnaround, before ordering',
				action: 'Get a quote',
			},
		],
		default: 'get',
	},
];

const show = { resource: ['quote'], operation: ['get'] };

export const quoteFields: INodeProperties[] = [
	{
		displayName: 'Source Language Name or ID',
		name: 'languageFrom',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLanguages' },
		required: true,
		default: '',
		description:
			'Language of the document. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show },
	},
	{
		displayName: 'Target Language Name or ID',
		name: 'languageTo',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLanguages' },
		default: 'english',
		description:
			'Language to translate into. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show },
	},
	{
		displayName: 'Pages',
		name: 'pages',
		type: 'number',
		typeOptions: { minValue: 1 },
		required: true,
		default: 1,
		description: 'Number of certified pages. One page is up to 250 words.',
		displayOptions: { show },
	},
	{
		displayName: 'Notarization',
		name: 'notarization',
		type: 'boolean',
		default: false,
		description: 'Whether to include notarization in the price',
		displayOptions: { show },
	},
];
