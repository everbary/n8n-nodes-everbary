import type { INodeProperties } from 'n8n-workflow';

export const paymentLinkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['paymentLink'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get the link anyone can use to pay an unpaid order',
				action: 'Get a payment link',
			},
			{
				name: 'Send',
				value: 'send',
				description: 'Email the payment link of an order to whoever pays',
				action: 'Send a payment link',
			},
		],
		default: 'get',
	},
];

export const paymentLinkFields: INodeProperties[] = [
	{
		displayName: 'Order Number',
		name: 'orderNumber',
		type: 'number',
		typeOptions: { minValue: 1 },
		required: true,
		default: 0,
		description: 'The eVerbary order number, e.g. 44316',
		displayOptions: { show: { resource: ['paymentLink'] } },
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		description: 'Email address of the person who pays',
		displayOptions: { show: { resource: ['paymentLink'], operation: ['send'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['paymentLink'], operation: ['send'] } },
		options: [
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description:
					'Text of the email. The payment link is added at the end if the text does not include it.',
			},
			{
				displayName: 'From Name',
				name: 'from_name',
				type: 'string',
				default: '',
				description: 'Name the email appears to come from',
			},
			{
				displayName: 'Reply To',
				name: 'reply_to',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'Address that replies go to, usually yours',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				description:
					'Subject of the email. Defaults to "Payment link for your certified translation".',
			},
		],
	},
];
