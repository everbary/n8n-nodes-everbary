import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

export const ORDER_STATUSES: INodePropertyOptions[] = [
	{ name: 'Assigned', value: 'assigned' },
	{ name: 'Awaits Approval', value: 'user-review' },
	{ name: 'Cancellation Hold', value: 'cancel-hold' },
	{ name: 'Cancelled', value: 'cancelled' },
	{ name: 'Completed', value: 'completed' },
	{ name: 'Draft', value: 'created' },
	{ name: 'In Progress', value: 'in-progress' },
	{ name: 'New', value: 'new' },
	{ name: 'On Hold', value: 'on-hold' },
	{ name: 'Quality Check', value: 'support-review' },
	{ name: 'Refunded', value: 'refunded' },
	{ name: 'Revision', value: 'revision' },
];

export const orderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['order'] } },
		options: [
			{
				name: 'Advance Sandbox Order',
				value: 'advance',
				description:
					'Test keys only: move a sandbox order to its next status now instead of waiting',
				action: 'Advance a sandbox order',
			},
			{
				name: 'Create',
				value: 'create',
				description:
					'Place a certified translation order with documents from a previous node. The order is placed unpaid; nothing is charged.',
				action: 'Create an order',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the status of an order, and its finished files once they exist',
				action: 'Get an order',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: "Get the account's most recent orders, newest first",
				action: 'Get many orders',
			},
		],
		default: 'create',
	},
];

const create = { resource: ['order'], operation: ['create'] };

export const orderFields: INodeProperties[] = [
	// ----------------------------------
	//         order: create
	// ----------------------------------
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		description:
			'Email of the eVerbary account the order belongs to. The order, invoice and finished translation go to this account.',
		displayOptions: { show: create },
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		required: true,
		default: '',
		description: 'First name of the person placing the order',
		displayOptions: { show: create },
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		required: true,
		default: '',
		description: 'Last name of the person placing the order',
		displayOptions: { show: create },
	},
	{
		displayName: 'Source Language Name or ID',
		name: 'languageFrom',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLanguages' },
		required: true,
		default: '',
		description:
			'Language of the documents. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: create },
	},
	{
		displayName: 'Target Language Name or ID',
		name: 'languageTo',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLanguages' },
		default: 'english',
		description:
			'Language to translate into. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: create },
	},
	{
		displayName: 'Pages',
		name: 'pages',
		type: 'number',
		typeOptions: { minValue: 1 },
		required: true,
		default: 1,
		description:
			'Number of certified pages, up to 250 words each. eVerbary staff check the count, as for orders placed on the website.',
		displayOptions: { show: create },
	},
	{
		displayName: 'Input Binary Fields',
		name: 'binaryPropertyNames',
		type: 'string',
		required: true,
		default: 'data',
		placeholder: 'e.g. data, data2',
		hint: 'The names of the input binary fields holding the documents, separated by commas',
		description:
			'Binary fields of the input item that hold the source documents (PDF, image or Word). All of them are attached to one order.',
		displayOptions: { show: create },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: create },
		options: [
			{
				displayName: 'Case Number',
				name: 'case_number',
				type: 'string',
				default: '',
				description: "The client's case number, printed on the invoice",
			},
			{
				displayName: 'Client First Name',
				name: 'client_first_name',
				type: 'string',
				default: '',
				description: 'First name of the client the documents belong to, if not the person ordering',
			},
			{
				displayName: 'Client Last Name',
				name: 'client_last_name',
				type: 'string',
				default: '',
				description: 'Last name of the client the documents belong to, if not the person ordering',
			},
			{
				displayName: 'Expedited',
				name: 'expedited',
				type: 'boolean',
				default: false,
				description: 'Whether to rush the order. Adds 20% of the page total.',
			},
			{
				displayName: 'Expedited Plus',
				name: 'expedited_plus',
				type: 'boolean',
				default: false,
				description:
					'Whether to order the fastest turnaround. Adds 40% of the page total. Only for some languages and during Eastern business hours; the order is rejected otherwise.',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'A retried request with the same key returns the first order instead of placing a second one. When empty, one is derived from the execution and item, so a retry of the same execution does not place a duplicate.',
			},
			{
				displayName: 'Notarization',
				name: 'notarization',
				type: 'boolean',
				default: false,
				description: 'Whether to notarize the translation. Adds a flat $34.90.',
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'A note for the eVerbary team, shown beside the order',
			},
			{
				displayName: 'Reference',
				name: 'reference',
				type: 'string',
				default: '',
				description: 'Your own reference, shown to eVerbary staff',
			},
			{
				displayName: 'Source',
				name: 'source',
				type: 'string',
				default: 'n8n',
				description: 'Where the order came from, shown to eVerbary staff',
			},
		],
	},

	// ----------------------------------
	//     order: get, advance
	// ----------------------------------
	{
		displayName: 'Order Number',
		name: 'orderNumber',
		type: 'number',
		typeOptions: { minValue: 1 },
		required: true,
		default: 0,
		description: 'The eVerbary order number, e.g. 44316 (sandbox orders start at 900001)',
		displayOptions: { show: { resource: ['order'], operation: ['get', 'advance'] } },
	},
	{
		displayName: 'Move To',
		name: 'to',
		type: 'options',
		default: '',
		description: 'Status to move the sandbox order to',
		displayOptions: { show: { resource: ['order'], operation: ['advance'] } },
		options: [
			{ name: 'Next Status', value: '' },
			{ name: 'In Progress', value: 'in-progress' },
			{ name: 'Completed', value: 'completed' },
			{ name: 'Cancelled', value: 'cancelled' },
		],
	},

	// ----------------------------------
	//         order: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['order'], operation: ['getAll'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['order'], operation: ['getAll'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['order'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: ORDER_STATUSES,
				default: 'completed',
				description: 'Only orders in this status, among the 100 most recent',
			},
		],
	},
];
